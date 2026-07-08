import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { ArticlesRepository } from './articles.repository';
import type { RssGate } from './rss.gate';
import type { SourcesRepository } from './sources.repository';
import { SourcesService } from './sources.service';
import type { UserSourcesRepository } from './user-sources.repository';

describe('SourcesService', () => {
  let prisma: { $transaction: jest.Mock };
  let sourcesRepository: { findByUrl: jest.Mock; createWithinTransaction: jest.Mock };
  let userSourcesRepository: { exists: jest.Mock; create: jest.Mock; findAllByUser: jest.Mock };
  let articlesRepository: { upsertMany: jest.Mock };
  let rssGate: { fetch: jest.Mock };
  let service: SourcesService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: Prisma.TransactionClient) => unknown) =>
        callback({} as Prisma.TransactionClient),
      ),
    };
    sourcesRepository = { findByUrl: jest.fn(), createWithinTransaction: jest.fn() };
    userSourcesRepository = { exists: jest.fn(), create: jest.fn(), findAllByUser: jest.fn() };
    articlesRepository = { upsertMany: jest.fn() };
    rssGate = { fetch: jest.fn() };

    service = new SourcesService(
      prisma as unknown as never,
      sourcesRepository as unknown as SourcesRepository,
      userSourcesRepository as unknown as UserSourcesRepository,
      articlesRepository as unknown as ArticlesRepository,
      rssGate as unknown as RssGate,
    );
  });

  describe('addSource — новый Source', () => {
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

  describe('addSource — существующий Source', () => {
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

  describe('listForUser', () => {
    it('делегирует в UserSourcesRepository.findAllByUser', async () => {
      const rows = [{ userId: 'u1', sourceId: 's1' }];
      userSourcesRepository.findAllByUser.mockResolvedValue(rows);

      const result = await service.listForUser('u1');

      expect(result).toEqual(rows);
      expect(userSourcesRepository.findAllByUser).toHaveBeenCalledWith('u1');
    });
  });
});
