/** Результат разбора пользовательского ввода поля добавления источника. */
export type ParsedSourceInput =
  | { type: 'RSS'; url: string }
  | { type: 'TELEGRAM'; username: string };

// Анкорировано `^...$` и точка экранирована — иначе `txme/...` или RSS-URL с `/t.me/`
// в пути (например `https://example.com/t.me/foo`) дали бы ложное совпадение.
// Служебные сегменты (`/s/`, `/joinchat/`, `/addstickers/`) не проходят паттерн username,
// так как содержат символы вне `[a-zA-Z][a-zA-Z0-9_]{4,31}` или не совпадают целиком с `$`.
// Флаг `i` — домен `t.me` вводят и в верхнем регистре (`T.me/...`).
const TELEGRAM_LINK_PATTERN = /^(https?:\/\/)?t\.me\/([a-zA-Z][a-zA-Z0-9_]{4,31})\/?$/i;
// Реальные Telegram-username всегда начинаются с буквы.
const TELEGRAM_USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
// Хосты, зарезервированные под Telegram — ссылка на них, не распознанная как канал
// (служебный путь вида `/s/`, `/joinchat/`, `/addstickers/`), не является RSS-лентой.
const TELEGRAM_HOSTS = new Set(['t.me', 'www.t.me']);

/**
 * Определяет тип источника (RSS-лента или Telegram-канал) по строке, введённой пользователем
 * в единое поле формы добавления источника.
 */
export function parseSourceInput(input: string): ParsedSourceInput | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('@')) {
    const username = trimmed.slice(1);
    return TELEGRAM_USERNAME_PATTERN.test(username)
      ? { type: 'TELEGRAM', username: username.toLowerCase() }
      : null;
  }

  const telegramMatch = trimmed.match(TELEGRAM_LINK_PATTERN);
  if (telegramMatch) {
    return { type: 'TELEGRAM', username: telegramMatch[2].toLowerCase() };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    if (TELEGRAM_HOSTS.has(url.hostname.toLowerCase())) {
      // Ссылка на t.me, не подошедшая под формат канала (например /s/<username>,
      // /joinchat/..., /addstickers/...) — это не RSS-лента, а нераспознанный Telegram-URL.
      return null;
    }
    return { type: 'RSS', url: trimmed };
  } catch {
    return null;
  }
}
