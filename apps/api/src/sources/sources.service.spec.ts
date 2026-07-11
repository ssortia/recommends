import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { ArticlesRepository } from './articles.repository';
import type { RssGate } from './rss.gate';
import type { SourcesRepository } from './sources.repository';
import { SourcesService } from './sources.service';
import type { TelegramGate } from './telegram.gate';
import type { UserSourcesRepository } from './user-sources.repository';

describe('SourcesService', () => {
  let prisma: { $transaction: jest.Mock };
  let sourcesRepository: { findByUrl: jest.Mock; createWithinTransaction: jest.Mock };
  let userSourcesRepository: {
    exists: jest.Mock;
    create: jest.Mock;
    findAllByUser: jest.Mock;
    delete: jest.Mock;
  };
  let articlesRepository: { upsertMany: jest.Mock };
  let rssGate: { fetch: jest.Mock };
  let telegramGate: { fetch: jest.Mock };
  let service: SourcesService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback({} as Prisma.TransactionClient),
      ),
    };
    sourcesRepository = { findByUrl: jest.fn(), createWithinTransaction: jest.fn() };
    userSourcesRepository = {
      exists: jest.fn(),
      create: jest.fn(),
      findAllByUser: jest.fn(),
      delete: jest.fn(),
    };
    articlesRepository = { upsertMany: jest.fn() };
    rssGate = { fetch: jest.fn() };
    telegramGate = { fetch: jest.fn() };

    service = new SourcesService(
      prisma as unknown as never,
      sourcesRepository as unknown as SourcesRepository,
      userSourcesRepository as unknown as UserSourcesRepository,
      articlesRepository as unknown as ArticlesRepository,
      rssGate as unknown as RssGate,
      telegramGate as unknown as TelegramGate,
    );
  });

  describe('addSource — некорректный ввод', () => {
    it('бросает BadRequestException до любых сетевых вызовов, если SourceInputParser вернул null', async () => {
      await expect(service.addSource('u1', 'случайный текст')).rejects.toThrow(BadRequestException);
      expect(sourcesRepository.findByUrl).not.toHaveBeenCalled();
      expect(rssGate.fetch).not.toHaveBeenCalled();
      expect(telegramGate.fetch).not.toHaveBeenCalled();
    });
  });

  describe('addSource — RSS, новый Source', () => {
    it('создаёт Source/UserSource/статьи в транзакции и возвращает articlesCount', async () => {
      sourcesRepository.findByUrl.mockResolvedValue(null);
      rssGate.fetch.mockResolvedValue({ title: 'Example Feed', items: [{ guid: 'g1' }] });
      const createdSource = {
        id: 's1',
        url: 'https://example.com/feed.xml',
        title: 'Example Feed',
      };
      sourcesRepository.createWithinTransaction.mockResolvedValue(createdSource);
      articlesRepository.upsertMany.mockResolvedValue(3);

      const result = await service.addSource('u1', 'https://example.com/feed.xml');

      expect(result).toEqual({ source: createdSource, articlesCount: 3 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(sourcesRepository.createWithinTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'RSS',
          url: 'https://example.com/feed.xml',
          title: 'Example Feed',
        }),
      );
      expect(userSourcesRepository.create).toHaveBeenCalledWith('u1', 's1', expect.anything());
      expect(articlesRepository.upsertMany).toHaveBeenCalledWith(expect.anything(), 's1', [
        { guid: 'g1' },
      ]);
    });

    it('использует хост URL как title, если фид не отдаёт title', async () => {
      sourcesRepository.findByUrl.mockResolvedValue(null);
      rssGate.fetch.mockResolvedValue({ items: [] });
      sourcesRepository.createWithinTransaction.mockResolvedValue({ id: 's1' });
      articlesRepository.upsertMany.mockResolvedValue(0);

      await service.addSource('u1', 'https://example.com/feed.xml');

      expect(sourcesRepository.createWithinTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'example.com' }),
      );
    });

    it('бросает BadRequestException, если RssGate.fetch вернул null', async () => {
      sourcesRepository.findByUrl.mockResolvedValue(null);
      rssGate.fetch.mockResolvedValue(null);

      await expect(service.addSource('u1', 'https://bad.example.com')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('не оставляет частично созданных записей при сбое внутри транзакции', async () => {
      sourcesRepository.findByUrl.mockResolvedValue(null);
      rssGate.fetch.mockResolvedValue({ title: 'Example', items: [] });
      prisma.$transaction.mockRejectedValue(new Error('tx failed'));

      await expect(service.addSource('u1', 'https://example.com/feed.xml')).rejects.toThrow(
        'tx failed',
      );
    });
  });

  describe('addSource — RSS, существующий Source', () => {
    it('подписывает пользователя без повторного RssGate.fetch', async () => {
      const existingSource = { id: 's1', url: 'https://example.com/feed.xml' };
      sourcesRepository.findByUrl.mockResolvedValue(existingSource);
      userSourcesRepository.exists.mockResolvedValue(false);

      const result = await service.addSource('u2', 'https://example.com/feed.xml');

      expect(result).toEqual({ source: existingSource, articlesCount: 0 });
      expect(rssGate.fetch).not.toHaveBeenCalled();
      expect(userSourcesRepository.create).toHaveBeenCalledWith('u2', 's1');
    });

    it('бросает ConflictException при повторной подписке без сетевого запроса', async () => {
      const existingSource = { id: 's1', url: 'https://example.com/feed.xml' };
      sourcesRepository.findByUrl.mockResolvedValue(existingSource);
      userSourcesRepository.exists.mockResolvedValue(true);

      await expect(service.addSource('u1', 'https://example.com/feed.xml')).rejects.toThrow(
        ConflictException,
      );
      expect(rssGate.fetch).not.toHaveBeenCalled();
      expect(userSourcesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('addSource — Telegram, новый канал', () => {
    it('создаёт Source типа TELEGRAM/UserSource/статьи в транзакции и возвращает articlesCount', async () => {
      sourcesRepository.findByUrl.mockResolvedValue(null);
      telegramGate.fetch.mockResolvedValue({
        title: 'Channel Title',
        items: [{ guid: 'c/1' }],
      });
      const createdSource = {
        id: 's2',
        url: 'https://t.me/mychannel',
        title: 'Channel Title',
      };
      sourcesRepository.createWithinTransaction.mockResolvedValue(createdSource);
      articlesRepository.upsertMany.mockResolvedValue(1);

      const result = await service.addSource('u1', '@mychannel');

      expect(result).toEqual({ source: createdSource, articlesCount: 1 });
      expect(sourcesRepository.findByUrl).toHaveBeenCalledWith('https://t.me/mychannel');
      expect(telegramGate.fetch).toHaveBeenCalledWith('mychannel');
      expect(sourcesRepository.createWithinTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'TELEGRAM',
          url: 'https://t.me/mychannel',
          title: 'Channel Title',
        }),
      );
      expect(userSourcesRepository.create).toHaveBeenCalledWith('u1', 's2', expect.anything());
      expect(articlesRepository.upsertMany).toHaveBeenCalledWith(expect.anything(), 's2', [
        { guid: 'c/1' },
      ]);
    });

    it('использует @username как title, если канал не отдаёт title', async () => {
      sourcesRepository.findByUrl.mockResolvedValue(null);
      telegramGate.fetch.mockResolvedValue({ items: [] });
      sourcesRepository.createWithinTransaction.mockResolvedValue({ id: 's2' });
      articlesRepository.upsertMany.mockResolvedValue(0);

      await service.addSource('u1', '@mychannel');

      expect(sourcesRepository.createWithinTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: '@mychannel' }),
      );
    });

    it('бросает BadRequestException, если TelegramGate.fetch вернул null', async () => {
      sourcesRepository.findByUrl.mockResolvedValue(null);
      telegramGate.fetch.mockResolvedValue(null);

      await expect(service.addSource('u1', '@mychannel')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('addSource — Telegram, существующий канал', () => {
    it('подписывает пользователя без повторного TelegramGate.fetch', async () => {
      const existingSource = { id: 's2', url: 'https://t.me/mychannel' };
      sourcesRepository.findByUrl.mockResolvedValue(existingSource);
      userSourcesRepository.exists.mockResolvedValue(false);

      const result = await service.addSource('u2', 'https://t.me/mychannel');

      expect(result).toEqual({ source: existingSource, articlesCount: 0 });
      expect(telegramGate.fetch).not.toHaveBeenCalled();
      expect(userSourcesRepository.create).toHaveBeenCalledWith('u2', 's2');
    });

    it('бросает ConflictException при повторной подписке без сетевого запроса', async () => {
      const existingSource = { id: 's2', url: 'https://t.me/mychannel' };
      sourcesRepository.findByUrl.mockResolvedValue(existingSource);
      userSourcesRepository.exists.mockResolvedValue(true);

      await expect(service.addSource('u1', '@mychannel')).rejects.toThrow(ConflictException);
      expect(telegramGate.fetch).not.toHaveBeenCalled();
      expect(userSourcesRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('listForUser', () => {
    it('делегирует в UserSourcesRepository.findAllByUser', async () => {
      const rows = [{ userId: 'u1', sourceId: 's1' }];
      userSourcesRepository.findAllByUser.mockResolvedValue(rows);

      const result = await service.listForUser('u1');

      expect(result).toEqual(rows);
      expect(userSourcesRepository.findAllByUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('removeSource', () => {
    it('удаляет подписку, если она существует', async () => {
      userSourcesRepository.exists.mockResolvedValue(true);

      await service.removeSource('u1', 's1');

      expect(userSourcesRepository.exists).toHaveBeenCalledWith('u1', 's1');
      expect(userSourcesRepository.delete).toHaveBeenCalledWith('u1', 's1');
    });

    it('бросает NotFoundException, если подписки не существует', async () => {
      userSourcesRepository.exists.mockResolvedValue(false);

      await expect(service.removeSource('u1', 's1')).rejects.toThrow(NotFoundException);
      expect(userSourcesRepository.delete).not.toHaveBeenCalled();
    });

    it('превращает P2025 от delete() (TOCTOU-гонка после exists()) в NotFoundException', async () => {
      userSourcesRepository.exists.mockResolvedValue(true);
      userSourcesRepository.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: '5.0.0',
        }),
      );

      await expect(service.removeSource('u1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('пробрасывает прочие ошибки delete() без преобразования', async () => {
      userSourcesRepository.exists.mockResolvedValue(true);
      const unexpected = new Error('connection lost');
      userSourcesRepository.delete.mockRejectedValue(unexpected);

      await expect(service.removeSource('u1', 's1')).rejects.toThrow(unexpected);
    });
  });
});
