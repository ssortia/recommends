import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Подгружает корневой .env в process.env перед запуском e2e-сьютов.
 * Без этого AppModule -> getEnv() падает с process.exit(1) на отсутствии
 * DATABASE_URL/JWT-секретов. Парсим вручную, чтобы не тянуть dotenv в зависимости.
 */
function loadRootEnv(): void {
  const envPath = resolve(__dirname, '../../../.env');
  let content: string;
  try {
    content = readFileSync(envPath, 'utf8');
  } catch {
    // .env может отсутствовать в CI — там переменные приходят из окружения.
    return;
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    // Снимаем обрамляющие кавычки со значения.
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    // Уже заданные в окружении переменные имеют приоритет над .env.
    process.env[key] ??= value;
  }
}

loadRootEnv();
