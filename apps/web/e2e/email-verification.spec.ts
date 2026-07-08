import { expect, test } from '@playwright/test';

import { registerUser, uniqueEmail } from './helpers/api';
import { getLastToken } from './helpers/verification-token';

test.describe('Верификация email', () => {
  test('подтверждает почту по токену из письма', async ({ page }) => {
    const email = uniqueEmail('verify');
    await registerUser(email, 'password123');

    const token = await getLastToken(email, 'EMAIL_VERIFICATION');
    await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);

    await expect(page.getByText('Почта успешно подтверждена')).toBeVisible();
  });

  test('показывает ошибку и форму повтора при невалидном токене', async ({ page }) => {
    await page.goto('/verify-email?token=invalid-token');

    await expect(page.getByText('Ссылка недействительна или устарела')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Отправить письмо повторно' })).toBeVisible();
  });
});
