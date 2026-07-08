'use client';

import { useState } from 'react';

import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';
import Link from 'next/link';
import { z } from 'zod';

// В форме одно поле — пароль; token приходит из ссылки и подмешивается при сабмите.
const ResetPasswordFormSchema = z.object({
  password: z.string().min(8),
});

type ResetPasswordFormValues = z.infer<typeof ResetPasswordFormSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: ResetPasswordFormValues) {
    setServerError(null);

    try {
      await authApi.resetPassword(token, data.password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setServerError('Ссылка недействительна или устарела. Запросите сброс пароля заново.');
      } else {
        setServerError('Что-то пошло не так. Попробуйте позже.');
      }
      return;
    }

    setDone(true);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Новый пароль</CardTitle>
        <CardDescription>Задайте новый пароль для вашего аккаунта</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="text-muted-foreground text-sm">
            Пароль изменён.{' '}
            <Link href="/login" className="hover:text-foreground underline">
              Войти
            </Link>
          </p>
        ) : (
          <ZodForm schema={ResetPasswordFormSchema} onSubmit={onSubmit} className="space-y-4">
            <TextField
              name="password"
              label="Новый пароль"
              type="password"
              placeholder="••••••••"
              required
            />
            {serverError && (
              <p className="text-destructive text-sm">
                {serverError}{' '}
                <Link href="/forgot-password" className="underline">
                  Запросить заново
                </Link>
              </p>
            )}
            <Button type="submit" className="w-full">
              Сохранить пароль
            </Button>
          </ZodForm>
        )}
      </CardContent>
    </Card>
  );
}
