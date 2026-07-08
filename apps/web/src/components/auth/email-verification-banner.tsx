'use client';

import { useState } from 'react';

import { authApi } from '@/api/auth.api';
import { ApiError } from '@/lib/api';

/**
 * Баннер-напоминание о неподтверждённом email с возможностью повторной отправки письма.
 * Email берём из сессии, поэтому отдельной формы не требуется.
 */
export function EmailVerificationBanner({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');

  async function resend() {
    try {
      await authApi.resendVerification(email);
      setState('sent');
    } catch (err) {
      // Не раскрываем детали: даже при ошибке сообщение нейтральное.
      setState(err instanceof ApiError ? 'sent' : 'error');
    }
  }

  return (
    <div className="border-b border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/40 dark:text-yellow-200">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <span>Email не подтверждён. Проверьте почту, чтобы получить полный доступ.</span>
        {state === 'sent' ? (
          <span className="text-muted-foreground">Письмо отправлено повторно</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Отправить письмо повторно
          </button>
        )}
      </div>
    </div>
  );
}
