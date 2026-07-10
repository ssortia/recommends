import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';

import type { FeedItem } from './feed-item.interface';

export interface RssFeed {
  title?: string;
  items: FeedItem[];
}

/**
 * Gate над rss-parser (ADR-009): транспорт + парсинг, без доменной логики.
 * Возвращает сырые данные фида или null — исключения не бросает, сервис сам решает,
 * как трактовать недоступность/невалидность ленты.
 */
@Injectable()
export class RssGate {
  private readonly logger = new Logger(RssGate.name);
  private readonly parser = new Parser();

  async fetch(url: string): Promise<RssFeed | null> {
    try {
      const feed = await this.parser.parseURL(url);
      return { title: feed.title, items: feed.items ?? [] };
    } catch (error) {
      this.logger.warn({ msg: 'Не удалось получить/распарсить RSS-ленту', url, error });
      return null;
    }
  }
}
