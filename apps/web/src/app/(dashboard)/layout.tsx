import { redirect } from 'next/navigation';

import { EmailVerificationBanner } from '@/components/auth/email-verification-banner';
import { RoleProvider } from '@/components/auth/role-provider';
import { Header } from '@/components/header';

import { auth } from '../../auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || session.error === 'RefreshAccessTokenError') {
    redirect('/login');
  }

  return (
    <RoleProvider role={session.user.role}>
      <div className="bg-background min-h-screen">
        <Header role={session.user.role} email={session.user?.email} />
        {!session.user.isEmailVerified && session.user.email && (
          <EmailVerificationBanner email={session.user.email} />
        )}
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </RoleProvider>
  );
}
