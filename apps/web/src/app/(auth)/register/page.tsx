import type { Metadata } from 'next';

import { RegisterForm } from '../../../components/auth/register-form';

export const metadata: Metadata = { title: 'Регистрация | NexST' };

export default function RegisterPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <RegisterForm />
    </div>
  );
}
