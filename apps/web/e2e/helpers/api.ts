// Запросы идут со стороны Node, а API слушает только IPv4 — отсюда 127.0.0.1.
// Порт по умолчанию берётся из корневого `.env` (см. скрипт `test:e2e`),
// чтобы прогон в worktree не бил в стенд основного checkout.
const API_URL =
  process.env['PLAYWRIGHT_API_URL'] ?? `http://127.0.0.1:${process.env['API_PORT'] ?? '3001'}`;

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
