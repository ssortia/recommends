import type { Metadata } from 'next';

import { VerifyEmailStatus } from '../../../components/auth/verify-email-status';

export const metadata: Metadata = { title: 'Подтверждение email | NexST' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <VerifyEmailStatus token={token} />
    </div>
  );
}
