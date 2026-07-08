'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LoginDto } from '@repo/types';
import { LoginDtoSchema } from '@repo/types';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: LoginDto) {
    setServerError(null);

    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError('Неверный email или пароль');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Вход</CardTitle>
        <CardDescription>Введите email и пароль для доступа</CardDescription>
      </CardHeader>
      <CardContent>
        <ZodForm schema={LoginDtoSchema} onSubmit={onSubmit} className="space-y-4">
          <TextField
            name="email"
            label="Email"
            type="email"
            placeholder="admin@example.com"
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
            Войти
          </Button>
        </ZodForm>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/forgot-password" className="hover:text-foreground underline">
            Забыли пароль?
          </Link>
        </p>
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Нет аккаунта?{' '}
          <Link href="/register" className="hover:text-foreground underline">
            Зарегистрироваться
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
