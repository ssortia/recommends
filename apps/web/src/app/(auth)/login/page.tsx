import type { Metadata } from 'next';

import { LoginForm } from '../../../components/auth/login-form';

export const metadata: Metadata = {
  title: 'Login | Curio',
};

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <LoginForm />
    </div>
  );
}
