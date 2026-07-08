const API_URL = process.env['PLAYWRIGHT_API_URL'] ?? 'http://localhost:3001';

/** Регистрирует пользователя напрямую через API (подготовка состояния для UI-теста). */
export async function registerUser(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Регистрация ${email} не удалась: HTTP ${res.status}`);
  }
}

/** Уникальный email на прогон, чтобы тесты не конфликтовали по существующим адресам. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
}
