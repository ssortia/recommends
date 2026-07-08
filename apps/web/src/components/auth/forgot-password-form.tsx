'use client';

import { useState } from 'react';

import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ForgotPasswordDto } from '@repo/types';
import { ForgotPasswordDtoSchema } from '@repo/types';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';
import Link from 'next/link';

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: ForgotPasswordDto) {
    setServerError(null);

    try {
      await authApi.forgotPassword(data.email);
    } catch {
      setServerError('Что-то пошло не так. Попробуйте позже.');
      return;
    }

    // Нейтральный ответ: не раскрываем, зарегистрирован ли адрес.
    setSubmitted(true);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Восстановление пароля</CardTitle>
        <CardDescription>Укажите email — пришлём ссылку для сброса пароля</CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <p className="text-muted-foreground text-sm">
            Если этот адрес зарегистрирован, мы отправили на него ссылку для сброса пароля.
            Проверьте почту.
          </p>
        ) : (
          <ZodForm schema={ForgotPasswordDtoSchema} onSubmit={onSubmit} className="space-y-4">
            <TextField
              name="email"
              label="Email"
              type="email"
              placeholder="user@example.com"
              required
            />
            {serverError && <p className="text-destructive text-sm">{serverError}</p>}
            <Button type="submit" className="w-full">
              Отправить ссылку
            </Button>
          </ZodForm>
        )}
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/login" className="hover:text-foreground underline">
            Вернуться ко входу
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
