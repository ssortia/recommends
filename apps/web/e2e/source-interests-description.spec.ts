import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

/** Локальный HTTP-сервер, отдающий статичный RSS-фид с заданным title — без зависимости от внешней сети в e2e. */
function feedXml(title: string): string {
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

// Хост, по которому API-процесс достучится до этого mock-сервера (см. sources.spec.ts).
const FEED_HOST = process.env['E2E_RSS_FEED_HOST'] ?? '127.0.0.1';

function startFeedServer(title: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      res.end(feedXml(title));
    });
    server.listen(0, '0.0.0.0', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://${FEED_HOST}:${port}/feed.xml` });
    });
  });
}

async function loginAsVerifiedUser(page: Page): Promise<void> {
  const email = uniqueEmail('source-interests');
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
 * Переход на /sources с ожиданием гидратации next-auth сессии на клиенте (см. sources.spec.ts /
 * interests-description.spec.ts — тот же паттерн `networkidle`).
 */
async function gotoSources(page: Page): Promise<void> {
  await page.goto('/sources');
  await page.waitForLoadState('networkidle');
}

async function addSource(page: Page, feedUrl: string, title: string): Promise<void> {
  await page.getByLabel('Источник').fill(feedUrl);
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByText(title)).toBeVisible();
}

/**
 * Карточка источника — сама `Card` (`rounded-lg border`, см. `components/ui/card.tsx`),
 * а не вложенный `flex justify-between` со шапкой, чтобы внутри локатора была доступна
 * и раскрытая `SourceInterestsForm` (рендерится отдельным блоком внутри той же `Card`).
 */
function sourceCard(page: Page, title: string): Locator {
  return page.locator('div.rounded-lg.border').filter({ hasText: title });
}

test.describe('Индивидуальное описание интересов источника', () => {
  let feedServerA: Server;
  let feedUrlA: string;
  let feedServerB: Server;
  let feedUrlB: string;

  test.beforeAll(async () => {
    const startedA = await startFeedServer('E2E Source A');
    feedServerA = startedA.server;
    feedUrlA = startedA.url;

    const startedB = await startFeedServer('E2E Source B');
    feedServerB = startedB.server;
    feedUrlB = startedB.url;
  });

  test.afterAll(async () => {
    await new Promise((resolve) => feedServerA.close(resolve));
    await new Promise((resolve) => feedServerB.close(resolve));
  });

  test('сохраняет описание интересов источника и оно остаётся после перезагрузки страницы', async ({
    page,
  }) => {
    await loginAsVerifiedUser(page);
    await gotoSources(page);
    await addSource(page, feedUrlA, 'E2E Source A');

    const card = sourceCard(page, 'E2E Source A');
    await card.getByRole('button', { name: 'Интересы' }).click();

    const textarea = card.getByLabel('Интересы для этого источника');
    await expect(textarea).toBeVisible();
    await textarea.fill('Только новости про космос из этого источника');

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/preferences/sources/') && res.request().method() === 'PATCH',
      ),
      card.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    await expect(textarea).toHaveValue('Только новости про космос из этого источника');

    await page.reload();
    await page.waitForLoadState('networkidle');

    const cardAfterReload = sourceCard(page, 'E2E Source A');
    await cardAfterReload.getByRole('button', { name: 'Интересы' }).click();
    await expect(cardAfterReload.getByLabel('Интересы для этого источника')).toHaveValue(
      'Только новости про космос из этого источника',
    );
  });

  test('очистка описания интересов источника сохраняется и не влияет на общее описание интересов', async ({
    page,
  }) => {
    await loginAsVerifiedUser(page);
    await gotoSources(page);

    // Общее описание интересов (#12) — заполняем, чтобы проверить, что оно не затирается.
    const generalTextarea = page.getByLabel('Описание интересов');
    await generalTextarea.fill('Общие интересы: наука и технологии');
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/preferences') && res.request().method() === 'PATCH',
      ),
      page.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    await expect(generalTextarea).toHaveValue('Общие интересы: наука и технологии');

    await addSource(page, feedUrlA, 'E2E Source A');
    const card = sourceCard(page, 'E2E Source A');
    await card.getByRole('button', { name: 'Интересы' }).click();

    const textarea = card.getByLabel('Интересы для этого источника');
    await textarea.fill('Временное описание источника');
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/preferences/sources/') && res.request().method() === 'PATCH',
      ),
      card.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    await expect(textarea).toHaveValue('Временное описание источника');

    await textarea.fill('');
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/preferences/sources/') && res.request().method() === 'PATCH',
      ),
      card.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    await expect(textarea).toHaveValue('');

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Общее описание интересов не затронуто очисткой описания источника.
    await expect(page.getByLabel('Описание интересов')).toHaveValue(
      'Общие интересы: наука и технологии',
    );

    const cardAfterReload = sourceCard(page, 'E2E Source A');
    await cardAfterReload.getByRole('button', { name: 'Интересы' }).click();
    await expect(cardAfterReload.getByLabel('Интересы для этого источника')).toHaveValue('');
  });

  test('описание интересов не пересекается между двумя разными источниками одного пользователя', async ({
    page,
  }) => {
    await loginAsVerifiedUser(page);
    await gotoSources(page);

    await addSource(page, feedUrlA, 'E2E Source A');
    await addSource(page, feedUrlB, 'E2E Source B');

    const cardA = sourceCard(page, 'E2E Source A');
    await cardA.getByRole('button', { name: 'Интересы' }).click();
    const textareaA = cardA.getByLabel('Интересы для этого источника');
    await textareaA.fill('Интересы для источника A');
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/preferences/sources/') && res.request().method() === 'PATCH',
      ),
      cardA.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    await expect(textareaA).toHaveValue('Интересы для источника A');

    const cardB = sourceCard(page, 'E2E Source B');
    await cardB.getByRole('button', { name: 'Интересы' }).click();
    const textareaB = cardB.getByLabel('Интересы для этого источника');
    await expect(textareaB).toHaveValue('');
    await textareaB.fill('Интересы для источника B');
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/preferences/sources/') && res.request().method() === 'PATCH',
      ),
      cardB.getByRole('button', { name: 'Сохранить' }).click(),
    ]);
    await expect(textareaB).toHaveValue('Интересы для источника B');

    // Значения не перепутались между источниками.
    await expect(textareaA).toHaveValue('Интересы для источника A');
    await expect(textareaB).toHaveValue('Интересы для источника B');

    await page.reload();
    await page.waitForLoadState('networkidle');

    const cardAAfterReload = sourceCard(page, 'E2E Source A');
    await cardAAfterReload.getByRole('button', { name: 'Интересы' }).click();
    await expect(cardAAfterReload.getByLabel('Интересы для этого источника')).toHaveValue(
      'Интересы для источника A',
    );

    const cardBAfterReload = sourceCard(page, 'E2E Source B');
    await cardBAfterReload.getByRole('button', { name: 'Интересы' }).click();
    await expect(cardBAfterReload.getByLabel('Интересы для этого источника')).toHaveValue(
      'Интересы для источника B',
    );
  });
});
