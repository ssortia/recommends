'use client';

import { useState } from 'react';

import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/button';
import type { ResendVerificationDto } from '@repo/types';
import { ResendVerificationDtoSchema } from '@repo/types';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';

/**
 * Инлайн-форма повторной отправки письма верификации без собственной Card-обёртки —
 * встраивается в страницу verify-email и в баннер дашборда.
 */
export function ResendVerificationForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: ResendVerificationDto) {
    setServerError(null);

    try {
      await authApi.resendVerification(data.email);
    } catch {
      setServerError('Что-то пошло не так. Попробуйте позже.');
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="text-muted-foreground text-sm">
        Если этот адрес зарегистрирован и ещё не подтверждён, мы отправили на него новое письмо.
      </p>
    );
  }

  return (
    <ZodForm
      schema={ResendVerificationDtoSchema}
      onSubmit={onSubmit}
      defaultValues={{ email: defaultEmail }}
      className="space-y-3"
    >
      <TextField name="email" label="Email" type="email" placeholder="user@example.com" required />
      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      <Button type="submit" className="w-full">
        Отправить письмо повторно
      </Button>
    </ZodForm>
  );
}
