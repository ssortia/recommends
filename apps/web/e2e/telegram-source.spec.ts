import { createServer, type Server } from 'node:http';

import { expect, test } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

/**
 * Фиксированный порт mock-сервера. В отличие от e2e/sources.spec.ts (RSS, listen(0)),
 * здесь порт должен быть известен ДО старта API-процесса, т.к. `TELEGRAM_PREVIEW_BASE_URL`
 * читается один раз при старте API (`getEnv()` кеширует значение) — см. Task 9 в плане
 * docs/plans/20260710-add-telegram-source.md. Перед прогоном e2e API должен быть запущен
 * с TELEGRAM_PREVIEW_BASE_URL=http://127.0.0.1:4310 (см. .env.example).
 */
const MOCK_PORT = 4310;

/** Строит HTML в формате t.me/s/<username>, минимально достаточный для TelegramGate. */
function buildChannelHtml(title: string): string {
  return `<!doctype html>
<html>
  <body>
    <div class="tgme_channel_info">
      <div class="tgme_channel_info_header_title">${title}</div>
    </div>
    <div class="tgme_widget_message" data-post="testchannel/1">
      <div class="tgme_widget_message_text">Первый тестовый пост</div>
      <time datetime="2026-01-01T00:00:00+00:00"></time>
    </div>
  </body>
</html>`;
}

/** Локальный HTTP-сервер, имитирующий публичную preview-страницу Telegram — на фиксированном порту. */
function startTelegramMockServer(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      // Любой /s/<username> отдаёт один и тот же валидный канал — регистр запроса не важен,
      // т.к. нормализацию регистра делает SourceInputParser на бэкенде (Task 3).
      if (req.url?.startsWith('/s/')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildChannelHtml('E2E Test Channel'));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    // Слушаем на всех интерфейсах: API может работать в Docker-контейнере и обращаться
    // к mock-серверу через адрес docker-моста хоста, а не через 127.0.0.1.
    server.listen(MOCK_PORT, () => resolve(server));
  });
}

async function loginAsVerifiedUser(page: import('@playwright/test').Page): Promise<void> {
  const email = uniqueEmail('telegram-source');
  const password = 'password123';
  await registerUser(email, password);

  const token = await getLastToken(email, 'EMAIL_VERIFICATION');
  await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/$/);
}

/**
 * Переход на /sources с ожиданием гидратации next-auth сессии на клиенте: форма добавления
 * не блокирует отправку, пока `useSession()` не подгрузил `accessToken`, поэтому мгновенный
 * submit сразу после goto может уйти без Authorization-заголовка. `networkidle` дожидается
 * завершения фонового запроса сессии.
 */
async function gotoSources(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/sources');
  await page.waitForLoadState('networkidle');
}

test.describe('Добавление Telegram-источника', () => {
  let mockServer: Server;

  test.beforeAll(async () => {
    mockServer = await startTelegramMockServer();
  });

  test.afterAll(async () => {
    await new Promise((resolve) => mockServer.close(resolve));
  });

  test('добавляет канал по @username и показывает его в списке источников', async ({ page }) => {
    await loginAsVerifiedUser(page);

    await gotoSources(page);
    await page.getByLabel('Источник').fill('@testchannel');
    await page.getByRole('button', { name: 'Добавить' }).click();

    await expect(page.getByText('E2E Test Channel')).toBeVisible();
  });

  test('показывает ошибку при повторном добавлении того же канала', async ({ page }) => {
    await loginAsVerifiedUser(page);

    await gotoSources(page);
    await page.getByLabel('Источник').fill('@testchannel');
    await page.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByText('E2E Test Channel')).toBeVisible();

    await page.getByLabel('Источник').fill('@testchannel');
    await page.getByRole('button', { name: 'Добавить' }).click();

    await expect(page.getByText('Источник уже добавлен')).toBeVisible();
  });

  test('трактует разный регистр (@Username и t.me/username) как один и тот же источник', async ({
    page,
  }) => {
    await loginAsVerifiedUser(page);

    await gotoSources(page);
    await page.getByLabel('Источник').fill('@Testchannel');
    await page.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByText('E2E Test Channel')).toBeVisible();

    await page.getByLabel('Источник').fill('t.me/testchannel');
    await page.getByRole('button', { name: 'Добавить' }).click();

    await expect(page.getByText('Источник уже добавлен')).toBeVisible();
  });
});
