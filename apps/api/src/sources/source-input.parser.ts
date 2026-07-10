/** Результат разбора пользовательского ввода поля добавления источника. */
export type ParsedSourceInput =
  | { type: 'RSS'; url: string }
  | { type: 'TELEGRAM'; username: string };

// Анкорировано `^...$` и точка экранирована — иначе `txme/...` или RSS-URL с `/t.me/`
// в пути (например `https://example.com/t.me/foo`) дали бы ложное совпадение.
// Служебные сегменты (`/s/`, `/joinchat/`, `/addstickers/`) не проходят паттерн username,
// так как содержат символы вне `[a-zA-Z0-9_]{5,32}` или не совпадают целиком с `$`.
const TELEGRAM_LINK_PATTERN = /^(https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})\/?$/;
const TELEGRAM_USERNAME_PATTERN = /^[a-zA-Z0-9_]{5,32}$/;

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
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return { type: 'RSS', url: trimmed };
    }
    return null;
  } catch {
    return null;
  }
}
