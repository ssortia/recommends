import type { Metadata } from 'next';

import { LoginForm } from '../../../components/auth/login-form';

export const metadata: Metadata = {
  title: 'Login | NexST',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoginForm />
    </div>
  );
}
