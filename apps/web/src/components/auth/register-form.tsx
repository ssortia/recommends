'use client';

import { useState } from 'react';

import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import type { RegisterDto } from '@repo/types';
import { RegisterDtoSchema } from '@repo/types';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: RegisterDto) {
    setServerError(null);

    try {
      await authApi.register({ email: data.email, password: data.password });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setServerError('Пользователь с таким email уже существует');
      } else {
        setServerError('Ошибка регистрации');
      }
      return;
    }

    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError('Ошибка входа после регистрации');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Регистрация</CardTitle>
        <CardDescription>Создайте новый аккаунт</CardDescription>
      </CardHeader>
      <CardContent>
        <ZodForm schema={RegisterDtoSchema} onSubmit={onSubmit} className="space-y-4">
          <TextField
            name="email"
            label="Email"
            type="email"
            placeholder="user@example.com"
            required
          />
          <TextField
            name="password"
            label="Пароль"
            type="password"
            placeholder="••••••••"
            required
          />
          {serverError && <p className="text-destructive text-sm">{serverError}</p>}
          <Button type="submit" className="w-full">
            Зарегистрироваться
          </Button>
        </ZodForm>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="hover:text-foreground underline">
            Войти
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
