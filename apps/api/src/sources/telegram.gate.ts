import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

import { getEnv } from '../config/env';

import type { FeedItem } from './feed-item.interface';

export interface TelegramFeed {
  title?: string;
  photoUrl?: string;
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
    // Убираем завершающий слэш — иначе при TELEGRAM_PREVIEW_BASE_URL с `/` на конце
    // получится URL с двойным слэшем.
    const baseUrl = getEnv().TELEGRAM_PREVIEW_BASE_URL.replace(/\/+$/, '');
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

      // Аватарка канала: <i class="tgme_page_photo_image"><img src="..."></i>; если фото не
      // задано, Telegram рендерит вместо <img> цветной кружок с инициалами — src нет.
      const photoUrl = this.toHttpUrl(
        $('.tgme_channel_info_header .tgme_page_photo_image img').first().attr('src'),
      );

      const items: FeedItem[] = $('.tgme_widget_message')
        .map((_, el) => {
          const $el = $(el);
          const guid = $el.attr('data-post');
          // Заменяем <br> на пробел перед извлечением текста — иначе многострочный
          // пост схлопывается в слитную строку без разделителей между строками.
          const $text = $el.find('.tgme_widget_message_text').first();
          $text.find('br').replaceWith(' ');
          const text = $text.text().trim();
          const isoDate = $el.find('time').first().attr('datetime');

          return {
            guid,
            link: guid ? `https://t.me/${guid}` : undefined,
            title: text ? text.slice(0, TITLE_MAX_LENGTH) : undefined,
            isoDate,
          };
        })
        .get();

      return { title, photoUrl, items };
    } catch (error) {
      this.logger.warn({ msg: 'Не удалось получить/распарсить Telegram-канал', username, error });
      return null;
    }
  }

  // Допускает только http(s) — src аватарки всегда абсолютный URL с CDN Telegram,
  // но на всякий случай проверяем протокол по аналогии с FaviconGate.
  private toHttpUrl(src: string | undefined): string | undefined {
    if (!src) {
      return undefined;
    }

    try {
      const url = new URL(src);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }
}
