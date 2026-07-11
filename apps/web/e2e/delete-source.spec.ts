import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

const DEFAULT_FEED_TITLE = 'E2E Delete Test Feed';

function buildFeedXml(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${title}</title>
    <item>
      <title>Test Post</title>
      <link>https://example.com/test-post</link>
      <guid>test-post-1</guid>
    </item>
  </channel>
</rss>`;
}

// См. комментарий в e2e/sources.spec.ts — тот же приём для доступа API-процесса к mock-серверу.
const FEED_HOST = process.env['E2E_RSS_FEED_HOST'] ?? '127.0.0.1';

/**
 * Локальный HTTP-сервер, отдающий статичный RSS-фид — без зависимости от внешней сети в e2e.
 * Параметр `title` позволяет поднять несколько разных источников для теста с несколькими карточками.
 */
function startFeedServer(title = DEFAULT_FEED_TITLE): Promise<{ server: Server; url: string }> {
  const feedXml = buildFeedXml(title);
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      res.end(feedXml);
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

  test('при сбое запроса показывает ошибку в диалоге и не закрывает его', async ({ page }) => {
    await loginAsVerifiedUser(page);

    await gotoSources(page);
    await page.getByLabel('Источник').fill(feedUrl);
    await page.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByText('E2E Delete Test Feed')).toBeVisible();

    // Перехватываем DELETE-запрос и эмулируем сбой сервера, чтобы проверить путь ошибки мутации.
    await page.route('**/sources/**', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByRole('button', { name: 'Удалить подписку' }).click();
    await expect(page.getByText('Удалить источник?')).toBeVisible();
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();

    await expect(page.getByText('Не удалось удалить источник. Попробуйте ещё раз.')).toBeVisible();
    await expect(page.getByText('Удалить источник?')).toBeVisible();
    // exact: true — иначе матчится и на карточку, и на текст в открытом диалоге подтверждения.
    await expect(page.getByText('E2E Delete Test Feed', { exact: true })).toBeVisible();

    // Снимаем перехват и подтверждаем, что после успешного повтора источник всё же удаляется.
    await page.unroute('**/sources/**');
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();

    await expect(page.getByText('Удалить источник?')).not.toBeVisible();
    await expect(page.getByText('E2E Delete Test Feed', { exact: true })).not.toBeVisible();
  });

  test('с несколькими источниками удаляет только выбранный', async ({ page }) => {
    await loginAsVerifiedUser(page);
    const secondFeedServer = await startFeedServer('Second Feed');

    try {
      await gotoSources(page);

      await page.getByLabel('Источник').fill(feedUrl);
      await page.getByRole('button', { name: 'Добавить' }).click();
      await expect(page.getByText('E2E Delete Test Feed')).toBeVisible();

      await page.getByLabel('Источник').fill(secondFeedServer.url);
      await page.getByRole('button', { name: 'Добавить' }).click();
      await expect(page.getByText('Second Feed')).toBeVisible();

      // Удаляем карточку именно первого источника — сужаем поиск до уровня Card (не всех
      // вложенных div с этим текстом), чтобы получить ровно одну карточку.
      const firstCard = page.locator('.rounded-lg.border.bg-card').filter({
        hasText: 'E2E Delete Test Feed',
      });
      await firstCard.getByRole('button', { name: 'Удалить подписку' }).click();
      await expect(page.getByText('Удалить источник?')).toBeVisible();
      await page.getByRole('button', { name: 'Удалить', exact: true }).click();

      await expect(page.getByText('E2E Delete Test Feed', { exact: true })).not.toBeVisible();
      await expect(page.getByText('Second Feed')).toBeVisible();
    } finally {
      await new Promise((resolve) => secondFeedServer.server.close(resolve));
    }
  });
});
