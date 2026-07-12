import { redirect } from 'next/navigation';

import { RoleProvider } from '@/components/auth/role-provider';
import { Header } from '@/components/header';

import { auth } from '../../auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session || session.error === 'RefreshAccessTokenError') {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <RoleProvider role={session.user.role}>
      <div className="bg-background min-h-screen">
        <Header role={session.user.role} email={session.user?.email} />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </RoleProvider>
  );
}
