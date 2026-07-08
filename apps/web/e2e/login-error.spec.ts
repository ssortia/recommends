import { expect, test } from '@playwright/test';

import { uniqueEmail } from './helpers/api';

// Покрывает UX страницы логина: при ошибке next-auth форма показывает
// фиксированную строку и остаётся на /login. Это сообщение задаётся клиентом
// (login-form.tsx) и НЕ зависит от тела ответа API — единый формат ApiErrorBody
// покрывается бэкенд-e2e (apps/api/test/app.e2e-spec.ts).
test.describe('Ошибка входа', () => {
  test('показывает сообщение об ошибке при неверных учётных данных', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(uniqueEmail('no-such-user'));
    await page.getByLabel('Пароль').fill('wrong-password123');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page.getByText('Неверный email или пароль')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
