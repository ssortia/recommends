import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Source } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { ArticlesRepository } from './articles.repository';
import { RssGate } from './rss.gate';
import { SourcesRepository } from './sources.repository';
import type { UserSourceWithSource } from './user-sources.repository';
import { UserSourcesRepository } from './user-sources.repository';

export interface AddSourceResult {
  source: Source;
  articlesCount: number;
}

@Injectable()
export class SourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sourcesRepository: SourcesRepository,
    private readonly userSourcesRepository: UserSourcesRepository,
    private readonly articlesRepository: ArticlesRepository,
    private readonly rssGate: RssGate,
  ) {}

  async addSource(userId: string, url: string): Promise<AddSourceResult> {
    const existingSource = await this.sourcesRepository.findByUrl(url);

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

    const feed = await this.rssGate.fetch(url);
    if (!feed) {
      throw new BadRequestException('Не удалось получить RSS-ленту по указанному URL');
    }

    return this.prisma.$transaction(async (tx) => {
      const source = await this.sourcesRepository.createWithinTransaction(tx, {
        type: 'RSS',
        url,
        title: feed.title ?? new URL(url).host,
        lastFetchedAt: new Date(),
      });
      await this.userSourcesRepository.create(userId, source.id, tx);
      const articlesCount = await this.articlesRepository.upsertMany(tx, source.id, feed.items);

      return { source, articlesCount };
    });
  }

  listForUser(userId: string): Promise<UserSourceWithSource[]> {
    return this.userSourcesRepository.findAllByUser(userId);
  }
}
