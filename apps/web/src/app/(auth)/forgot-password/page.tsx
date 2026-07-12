import type { Metadata } from 'next';

import { ForgotPasswordForm } from '../../../components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Восстановление пароля | Curio' };

export default function ForgotPasswordPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <ForgotPasswordForm />
    </div>
  );
}
