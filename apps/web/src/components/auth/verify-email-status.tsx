'use client';

import { useEffect, useRef, useState } from 'react';

import { authApi } from '@/api/auth.api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

import { ResendVerificationForm } from './resend-verification-form';

type Status = 'loading' | 'success' | 'error';

export function VerifyEmailStatus({ token }: { token?: string }) {
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
  // Гард от повторного вызова: под React StrictMode эффект монтируется дважды,
  // а consume одноразовый — второй запрос вернул бы 400 и сбросил success в error.
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;

    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Подтверждение email</CardTitle>
        <CardDescription>
          {status === 'loading' && 'Проверяем ссылку…'}
          {status === 'success' && 'Email подтверждён'}
          {status === 'error' && 'Не удалось подтвердить email'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'loading' && (
          <p className="text-muted-foreground text-sm">Пожалуйста, подождите…</p>
        )}

        {status === 'success' && (
          <p className="text-muted-foreground text-sm">
            Почта успешно подтверждена.{' '}
            <Link href="/login" className="hover:text-foreground underline">
              Войти
            </Link>
          </p>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <p className="text-destructive text-sm">
              Ссылка недействительна или устарела. Запросите новое письмо подтверждения.
            </p>
            <ResendVerificationForm />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
