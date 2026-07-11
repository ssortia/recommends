import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>E2E Delete Test Feed</title>
    <item>
      <title>Test Post</title>
      <link>https://example.com/test-post</link>
      <guid>test-post-1</guid>
    </item>
  </channel>
</rss>`;

// См. комментарий в e2e/sources.spec.ts — тот же приём для доступа API-процесса к mock-серверу.
const FEED_HOST = process.env['E2E_RSS_FEED_HOST'] ?? '127.0.0.1';

/** Локальный HTTP-сервер, отдающий статичный RSS-фид — без зависимости от внешней сети в e2e. */
function startFeedServer(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      res.end(FEED_XML);
    });
    server.listen(0, '0.0.0.0', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://${FEED_HOST}:${port}/feed.xml` });
    });
  });
}

async function loginAsVerifiedUser(page: import('@playwright/test').Page): Promise<void> {
  const email = uniqueEmail('delete-source');
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
 * Переход на /sources с ожиданием гидратации next-auth сессии на клиенте — см. комментарий
 * в e2e/sources.spec.ts.
 */
async function gotoSources(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/sources');
  await page.waitForLoadState('networkidle');
}

test.describe('Удаление источника', () => {
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

  test('удаляет источник из списка после подтверждения в диалоге', async ({ page }) => {
    await loginAsVerifiedUser(page);

    await gotoSources(page);
    await page.getByLabel('Источник').fill(feedUrl);
    await page.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByText('E2E Delete Test Feed')).toBeVisible();

    await page.getByRole('button', { name: 'Удалить подписку' }).click();
    await expect(page.getByText('Удалить источник?')).toBeVisible();
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();

    await expect(page.getByText('Удалить источник?')).not.toBeVisible();
    await expect(page.getByText('E2E Delete Test Feed', { exact: true })).not.toBeVisible();
  });

  test('отмена в диалоге оставляет источник в списке', async ({ page }) => {
    await loginAsVerifiedUser(page);

    await gotoSources(page);
    await page.getByLabel('Источник').fill(feedUrl);
    await page.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByText('E2E Delete Test Feed')).toBeVisible();

    await page.getByRole('button', { name: 'Удалить подписку' }).click();
    await expect(page.getByText('Удалить источник?')).toBeVisible();
    await page.getByRole('button', { name: 'Отмена' }).click();

    await expect(page.getByText('Удалить источник?')).not.toBeVisible();
    await expect(page.getByText('E2E Delete Test Feed')).toBeVisible();
  });
});
