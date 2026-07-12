import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

const FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>E2E Icon Test Feed</title>
    <item>
      <title>Test Post</title>
      <link>https://example.com/test-post</link>
      <guid>test-post-1</guid>
    </item>
  </channel>
</rss>`;

// 1x1-пиксельный PNG — минимально достаточный, чтобы браузер распознал ответ как валидное
// изображение (иначе <img> вызовет onError так же, как при отсутствующем favicon).
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

// См. комментарий в e2e/sources.spec.ts — тот же приём для доступа API-процесса к mock-серверу.
const FEED_HOST = process.env['E2E_RSS_FEED_HOST'] ?? '127.0.0.1';

/**
 * Локальный HTTP-сервер, имитирующий сайт RSS-источника: `/feed.xml` отдаёт фид (по нему
 * добавляется источник), `/` — домашнюю страницу (по её origin `FaviconGate` ищет favicon).
 * `withIcon` управляет тем, есть ли на домашней странице `<link rel="icon">` и реальная
 * картинка по этому адресу — так тест различает путь «сохранённый favicon» и путь «fallback».
 */
function startSiteServer(withIcon: boolean): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url === '/feed.xml') {
        res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
        res.end(FEED_XML);
        return;
      }

      if (req.url === '/icon.png' && withIcon) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(ONE_PIXEL_PNG);
        return;
      }

      if (req.url === '/') {
        const iconTag = withIcon ? '<link rel="icon" href="/icon.png">' : '';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><head>${iconTag}</head><body></body></html>`);
        return;
      }

      // /favicon.ico (fallback FaviconGate) и любые прочие пути — намеренно 404,
      // чтобы в сценарии без иконки итоговый faviconUrl вёл на несуществующий ресурс
      // и фронтенд откатился на иконку по типу через onError.
      res.writeHead(404);
      res.end();
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
  const email = uniqueEmail('source-icon');
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

test.describe('Иконка источника в списке', () => {
  test('показывает favicon сайта, когда FaviconGate его находит', async ({ page }) => {
    const { server, url } = await startSiteServer(true);

    try {
      await loginAsVerifiedUser(page);

      await gotoSources(page);
      await page.getByLabel('Источник').fill(url);
      await page.getByRole('button', { name: 'Добавить' }).click();
      await expect(page.getByText('E2E Icon Test Feed')).toBeVisible();

      const card = page
        .locator('.rounded-lg.border.bg-card')
        .filter({ hasText: 'E2E Icon Test Feed' });
      const icon = card.getByTestId('source-icon-favicon');

      // Дожидаемся, что <img> реально отрисовала загруженную картинку (а не застряла
      // в состоянии ошибки) — иначе onError-фолбэк мог бы маскировать нерабочий favicon.
      await expect(icon).toHaveJSProperty('complete', true);
      await expect(icon).toHaveJSProperty('naturalWidth', 1);
      await expect(icon).toHaveAttribute('src', /\/icon\.png$/);
      await expect(card.getByTestId('source-icon-fallback')).toHaveCount(0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('показывает fallback-иконку по типу, когда favicon недоступен', async ({ page }) => {
    const { server, url } = await startSiteServer(false);

    try {
      await loginAsVerifiedUser(page);

      await gotoSources(page);
      await page.getByLabel('Источник').fill(url);
      await page.getByRole('button', { name: 'Добавить' }).click();
      await expect(page.getByText('E2E Icon Test Feed')).toBeVisible();

      const card = page
        .locator('.rounded-lg.border.bg-card')
        .filter({ hasText: 'E2E Icon Test Feed' });

      // <img> изначально указывает на несуществующий /favicon.ico (fallback FaviconGate),
      // после onError компонент переключается на svg-иконку RSS по типу источника.
      await expect(card.getByTestId('source-icon-fallback')).toBeVisible();
      await expect(card.getByTestId('source-icon-favicon')).toHaveCount(0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
