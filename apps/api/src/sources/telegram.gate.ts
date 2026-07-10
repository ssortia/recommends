import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

import { getEnv } from '../config/env';

import type { FeedItem } from './feed-item.interface';

export interface TelegramFeed {
  title?: string;
  items: FeedItem[];
}

// Ограничение длины превью текста поста в списке статей.
const TITLE_MAX_LENGTH = 200;

/**
 * Gate над публичной preview-страницей Telegram `t.me/s/<username>` (ADR-009):
 * транспорт + HTML-scraping, без доменной логики. Возвращает сырые данные канала
 * или null — исключения не бросает, сервис сам решает, как трактовать недоступность канала.
 */
@Injectable()
export class TelegramGate {
  private readonly logger = new Logger(TelegramGate.name);

  async fetch(username: string): Promise<TelegramFeed | null> {
    const baseUrl = getEnv().TELEGRAM_PREVIEW_BASE_URL;
    const url = `${baseUrl}/s/${username}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        return null;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Наличие блока .tgme_channel_info — признак валидного публичного канала;
      // его отсутствие означает, что канал не существует или приватный.
      if ($('.tgme_channel_info').length === 0) {
        return null;
      }

      const title = $('.tgme_channel_info_header_title').first().text().trim() || undefined;

      const items: FeedItem[] = $('.tgme_widget_message')
        .map((_, el) => {
          const $el = $(el);
          const guid = $el.attr('data-post');
          const text = $el.find('.tgme_widget_message_text').first().text().trim();
          const isoDate = $el.find('time').first().attr('datetime');

          return {
            guid,
            link: guid ? `https://t.me/${guid}` : undefined,
            title: text ? text.slice(0, TITLE_MAX_LENGTH) : undefined,
            isoDate,
          };
        })
        .get();

      return { title, items };
    } catch (error) {
      this.logger.warn({ msg: 'Не удалось получить/распарсить Telegram-канал', username, error });
      return null;
    }
  }
}
