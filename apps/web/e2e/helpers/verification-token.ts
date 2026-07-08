const API_URL = process.env['PLAYWRIGHT_API_URL'] ?? 'http://localhost:3001';

type TokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

/**
 * Забирает последний выпущенный plain-токен через test-only эндпоинт API.
 * В БД хранится только sha256-хэш, поэтому это единственный путь получить
 * исходный токен для подстановки в ссылку из письма.
 */
export async function getLastToken(email: string, type: TokenType): Promise<string> {
  const url = `${API_URL}/auth/__test/last-token?email=${encodeURIComponent(email)}&type=${type}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Не удалось получить ${type}-токен для ${email}: HTTP ${res.status}`);
  }

  const { token } = (await res.json()) as { token: string };
  return token;
}
