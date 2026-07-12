import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Source, type SourceType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { ArticlesRepository } from './articles.repository';
import { FaviconGate } from './favicon.gate';
import type { FeedItem } from './feed-item.interface';
import { RssGate } from './rss.gate';
import { parseSourceInput } from './source-input.parser';
import { SourcesRepository } from './sources.repository';
import { TelegramGate } from './telegram.gate';
import type { UserSourceWithSource } from './user-sources.repository';
import { UserSourcesRepository } from './user-sources.repository';

export interface AddSourceResult {
  source: Source;
  articlesCount: number;
}

interface AddSourceByTypeParams {
  type: SourceType;
  canonicalUrl: string;
  fallbackTitle: string;
  fetchFeed: () => Promise<{ title?: string; photoUrl?: string; items: FeedItem[] } | null>;
  notFoundMessage: string;
}

@Injectable()
export class SourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sourcesRepository: SourcesRepository,
    private readonly userSourcesRepository: UserSourcesRepository,
    private readonly articlesRepository: ArticlesRepository,
    private readonly rssGate: RssGate,
    private readonly telegramGate: TelegramGate,
    private readonly faviconGate: FaviconGate,
  ) {}

  async addSource(userId: string, input: string): Promise<AddSourceResult> {
    const parsed = parseSourceInput(input);
    if (!parsed) {
      throw new BadRequestException(
        'Некорректный формат: укажите URL RSS-ленты или @username/ссылку на Telegram-канал',
      );
    }

    if (parsed.type === 'RSS') {
      return this.addSourceByType(userId, {
        type: 'RSS',
        canonicalUrl: parsed.url,
        fallbackTitle: new URL(parsed.url).host,
        fetchFeed: () => this.rssGate.fetch(parsed.url),
        notFoundMessage: 'Не удалось получить RSS-ленту по указанному URL',
      });
    }

    return this.addSourceByType(userId, {
      type: 'TELEGRAM',
      canonicalUrl: `https://t.me/${parsed.username}`,
      fallbackTitle: `@${parsed.username}`,
      fetchFeed: () => this.telegramGate.fetch(parsed.username),
      notFoundMessage: 'Не удалось найти публичный Telegram-канал по указанному имени',
    });
  }

  // Общая часть addSource для любого типа источника: поиск существующего Source по url →
  // conflict/переиспользование → транзакция создания Source+UserSource+статей.
  private async addSourceByType(
    userId: string,
    { type, canonicalUrl, fallbackTitle, fetchFeed, notFoundMessage }: AddSourceByTypeParams,
  ): Promise<AddSourceResult> {
    const existingSource = await this.sourcesRepository.findByUrl(canonicalUrl);

    if (existingSource) {
      const alreadySubscribed = await this.userSourcesRepository.exists(userId, existingSource.id);
      if (alreadySubscribed) {
        throw new ConflictException('Источник уже добавлен');
      }

      // Источник уже существует и содержит статьи от предыдущего добавления —
      // повторный сетевой запрос не нужен, просто подписываем пользователя.
      await this.userSourcesRepository.create(userId, existingSource.id);
      return { source: existingSource, articlesCount: 0 };
    }

    const feed = await fetchFeed();
    if (!feed) {
      throw new BadRequestException(notFoundMessage);
    }

    // Для RSS favicon фетчится отдельным запросом до открытия транзакции — сетевой запрос
    // не должен выполняться под открытой БД-транзакцией. Для Telegram аватарка канала уже
    // пришла в составе feed (см. TelegramGate.fetch) — второй запрос не нужен.
    const faviconUrl =
      type === 'RSS'
        ? await this.faviconGate.fetch(new URL(canonicalUrl).origin)
        : (feed.photoUrl ?? null);

    return this.prisma.$transaction(async (tx) => {
      const source = await this.sourcesRepository.createWithinTransaction(tx, {
        type,
        url: canonicalUrl,
        title: feed.title ?? fallbackTitle,
        lastFetchedAt: new Date(),
        faviconUrl,
      });
      await this.userSourcesRepository.create(userId, source.id, tx);
      const articlesCount = await this.articlesRepository.upsertMany(tx, source.id, feed.items);

      return { source, articlesCount };
    });
  }

  listForUser(userId: string): Promise<UserSourceWithSource[]> {
    return this.userSourcesRepository.findAllByUser(userId);
  }

  // Source/Article намеренно не удаляются: данные общие между пользователями,
  // отписка убирает только связь UserSource текущего пользователя.
  async removeSource(userId: string, sourceId: string): Promise<void> {
    const subscribed = await this.userSourcesRepository.exists(userId, sourceId);
    if (!subscribed) {
      throw new NotFoundException('Подписка на источник не найдена');
    }

    try {
      await this.userSourcesRepository.delete(userId, sourceId);
    } catch (error) {
      // TOCTOU: между exists() и delete() запись могла удалиться конкурентным запросом —
      // Prisma в этом случае бросает P2025, превращаем его в тот же осмысленный 404.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Подписка на источник не найдена');
      }
      throw error;
    }
  }
}
