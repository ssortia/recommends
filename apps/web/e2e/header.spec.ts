import { expect, test } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

async function loginAsVerifiedUser(page: import('@playwright/test').Page): Promise<void> {
  const email = uniqueEmail('header');
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

test.describe('Хедер приложения', () => {
  test('клик по заголовку с внутренней страницы открывает главную', async ({ page }) => {
    await loginAsVerifiedUser(page);

    await page.goto('/sources');
    await expect(page.getByRole('link', { name: 'Curio' })).toBeVisible();

    await page.getByRole('link', { name: 'Curio' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
