import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>E2E Test Feed</title>
    <item>
      <title>Test Post</title>
      <link>https://example.com/test-post</link>
      <guid>test-post-1</guid>
    </item>
  </channel>
</rss>`;

// Хост, по которому API-процесс достучится до этого mock-сервера. Если API запущен в
// Docker-контейнере (см. docker-compose), '127.0.0.1' указывает на loopback самого
// контейнера, а не хоста — нужно переопределить на адрес docker-моста хоста
// (аналогично TELEGRAM_PREVIEW_BASE_URL для e2e/telegram-source.spec.ts, см. .env.example).
const FEED_HOST = process.env['E2E_RSS_FEED_HOST'] ?? '127.0.0.1';

/** Локальный HTTP-сервер, отдающий статичный RSS-фид — без зависимости от внешней сети в e2e. */
function startFeedServer(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      res.end(FEED_XML);
    });
    // Слушаем на всех интерфейсах: API может работать в Docker-контейнере и обращаться
    // к mock-серверу через адрес docker-моста хоста, а не через 127.0.0.1.
    server.listen(0, '0.0.0.0', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://${FEED_HOST}:${port}/feed.xml` });
    });
  });
}

async function loginAsVerifiedUser(page: import('@playwright/test').Page): Promise<void> {
  const email = uniqueEmail('sources');
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

test.describe('Добавление RSS-источника', () => {
  let feedServer: Server;
  let feedUrl: string;

  test.beforeAll(async () => {
    const started = await startFeedServer();
    feedServer = started.server;
    feedUrl = started.url;
  });

  test.afterAll(async () => {
    await new Promise((resolve) => feedServer.close(resolve));
  });

  test('добавляет валидный RSS URL и показывает источник в списке', async ({ page }) => {
    await loginAsVerifiedUser(page);

    await gotoSources(page);
    await page.getByLabel('Источник').fill(feedUrl);
    await page.getByRole('button', { name: 'Добавить' }).click();

    await expect(page.getByText('E2E Test Feed')).toBeVisible();
  });

  test('показывает ошибку при повторном добавлении того же источника', async ({ page }) => {
    await loginAsVerifiedUser(page);

    await gotoSources(page);
    await page.getByLabel('Источник').fill(feedUrl);
    await page.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByText('E2E Test Feed')).toBeVisible();

    await page.getByLabel('Источник').fill(feedUrl);
    await page.getByRole('button', { name: 'Добавить' }).click();

    await expect(page.getByText('Источник уже добавлен')).toBeVisible();
  });
});
