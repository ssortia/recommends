import { expect, test } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

test.describe('Сброс пароля', () => {
  test('меняет пароль по токену и пускает вход с новым паролем', async ({ page }) => {
    const email = uniqueEmail('reset');
    const newPassword = 'new-password456';
    await registerUser(email, 'old-password123');

    // Запрос ссылки через UI.
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Отправить ссылку' }).click();
    await expect(page.getByText('мы отправили на него ссылку для сброса')).toBeVisible();

    // Установка нового пароля по токену из письма.
    const token = await getLastToken(email, 'PASSWORD_RESET');
    await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
    await page.getByLabel('Новый пароль').fill(newPassword);
    await page.getByRole('button', { name: 'Сохранить пароль' }).click();
    await expect(page.getByText('Пароль изменён')).toBeVisible();

    // Вход новым паролем.
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль').fill(newPassword);
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page).toHaveURL('/');
  });

  test('отклоняет повторно использованный токен сброса', async ({ page }) => {
    const email = uniqueEmail('reset-reuse');
    await registerUser(email, 'old-password123');

    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Отправить ссылку' }).click();
    await expect(page.getByText('мы отправили на него ссылку для сброса')).toBeVisible();

    const token = await getLastToken(email, 'PASSWORD_RESET');

    // Первый сброс — успешный.
    await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
    await page.getByLabel('Новый пароль').fill('first-password789');
    await page.getByRole('button', { name: 'Сохранить пароль' }).click();
    await expect(page.getByText('Пароль изменён')).toBeVisible();

    // Повторное использование того же токена — отклонено.
    await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
    await page.getByLabel('Новый пароль').fill('second-password789');
    await page.getByRole('button', { name: 'Сохранить пароль' }).click();
    await expect(page.getByText('Ссылка недействительна или устарела')).toBeVisible();
  });
});
