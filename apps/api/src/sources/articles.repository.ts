import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { FeedItem } from './feed-item.interface';

@Injectable()
export class ArticlesRepository {
  // Сохраняет статьи фида в рамках транзакции. Дедупликация — через уникальный
  // индекс (sourceId, externalId): create + catch(P2002) вместо upsert, чтобы
  // точно знать, сколько статей реально новые (нужно для articlesCount ответа).
  async upsertMany(
    tx: Prisma.TransactionClient,
    sourceId: string,
    items: FeedItem[],
  ): Promise<number> {
    let newCount = 0;

    for (const item of items) {
      const externalId = item.guid ?? item.link;
      // Элемент без guid и без link нельзя надёжно дедуплицировать — пропускаем.
      if (!externalId) {
        continue;
      }

      const publishedAtRaw = item.isoDate ?? item.pubDate;
      const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : null;

      try {
        await tx.article.create({
          data: {
            sourceId,
            externalId,
            title: item.title ?? externalId,
            url: item.link ?? externalId,
            publishedAt,
          },
        });
        newCount += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }

    return newCount;
  }
}
