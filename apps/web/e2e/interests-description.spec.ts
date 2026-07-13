import { expect, test } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

async function loginAsVerifiedUser(page: import('@playwright/test').Page): Promise<void> {
  const email = uniqueEmail('interests');
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
 * Переход на /sources с ожиданием гидратации next-auth сессии на клиенте: форма описания
 * интересов не рендерится, пока `usePreferences()` не получил данные (см.
 * `InterestsDescriptionForm`), а сама сессия должна успеть подгрузить `accessToken` для запроса.
 */
async function gotoSources(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/sources');
  await page.waitForLoadState('networkidle');
}

test.describe('Описание интересов', () => {
  test('сохраняет описание интересов и оно сохраняется после перезагрузки страницы', async ({
    page,
  }) => {
    await loginAsVerifiedUser(page);
    await gotoSources(page);

    const textarea = page.getByLabel('Описание интересов');
    await textarea.fill('Люблю статьи про космос и биологию');
    await page.getByRole('button', { name: 'Сохранить' }).click();

    await expect(textarea).toHaveValue('Люблю статьи про космос и биологию');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('Описание интересов')).toHaveValue(
      'Люблю статьи про космос и биологию',
    );
  });

  test('очищает описание интересов и сброс сохраняется', async ({ page }) => {
    await loginAsVerifiedUser(page);
    await gotoSources(page);

    const textarea = page.getByLabel('Описание интересов');
    await textarea.fill('Временное описание');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(textarea).toHaveValue('Временное описание');

    await textarea.fill('');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(textarea).toHaveValue('');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('Описание интересов')).toHaveValue('');
  });
});
