import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

/**
 * Gate над HTML домашней страницы сайта (ADR-009): транспорт + HTML-scraping,
 * без доменной логики. Ищет `<link rel="icon">`/`<link rel="shortcut icon">`
 * и резолвит его в абсолютный URL; при отсутствии тега — fallback на `/favicon.ico`.
 * Исключения не бросает, при неудаче возвращает null — сервис сам решает, как
 * трактовать отсутствие favicon.
 */
// Таймаут запроса домашней страницы — источник может отвечать медленно/зависать,
// а этот gate вызывается синхронно в цепочке addSource.
const FETCH_TIMEOUT_MS = 5000;

@Injectable()
export class FaviconGate {
  private readonly logger = new Logger(FaviconGate.name);

  async fetch(pageUrl: string): Promise<string | null> {
    try {
      const res = await fetch(pageUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        return null;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      const href = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href');
      if (href) {
        return this.toHttpUrl(href, pageUrl);
      }

      // Тег <link rel="icon"> отсутствует — пробуем дефолтный путь браузера.
      return this.toHttpUrl('/favicon.ico', pageUrl);
    } catch (error) {
      this.logger.warn({ msg: 'Не удалось получить/распарсить favicon страницы', pageUrl, error });
      return null;
    }
  }

  // Резолвит href в абсолютный URL и допускает только http(s) — иначе можно
  // сохранить в общее поле faviconUrl что угодно (data:, javascript: и т.п.),
  // а картинка рендерится всем подписчикам источника.
  private toHttpUrl(href: string, base: string): string | null {
    const url = new URL(href, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.toString();
  }
}
