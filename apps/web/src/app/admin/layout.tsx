import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RoleProvider } from '@/components/auth/role-provider';
import { MainNav } from '@/components/main-nav';
import { ThemeToggle } from '@/components/theme-toggle';

import { auth, signOut } from '../../auth';

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
        <header className="border-b">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xl font-semibold">
                NexST
              </Link>
              <MainNav role={session.user.role} />
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <span className="text-muted-foreground text-sm">{session.user?.email}</span>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/login' });
                }}
              >
                <button
                  type="submit"
                  className="text-muted-foreground hover:text-foreground cursor-pointer text-sm transition-colors"
                >
                  Выйти
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </RoleProvider>
  );
}
