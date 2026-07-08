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

/** Локальный HTTP-сервер, отдающий статичный RSS-фид — без зависимости от внешней сети в e2e. */
function startFeedServer(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      res.end(FEED_XML);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/feed.xml` });
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

    await page.goto('/sources');
    await page.getByLabel('URL RSS-ленты').fill(feedUrl);
    await page.getByRole('button', { name: 'Добавить' }).click();

    await expect(page.getByText('E2E Test Feed')).toBeVisible();
  });

  test('показывает ошибку при повторном добавлении того же источника', async ({ page }) => {
    await loginAsVerifiedUser(page);

    await page.goto('/sources');
    await page.getByLabel('URL RSS-ленты').fill(feedUrl);
    await page.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByText('E2E Test Feed')).toBeVisible();

    await page.getByLabel('URL RSS-ленты').fill(feedUrl);
    await page.getByRole('button', { name: 'Добавить' }).click();

    await expect(page.getByText('Источник уже добавлен')).toBeVisible();
  });
});
