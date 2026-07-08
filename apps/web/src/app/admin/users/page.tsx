import { Suspense } from 'react';

import { auth } from '../../../auth';

import { UsersTable } from './users-table';

export default async function AdminUsersPage() {
  const session = await auth();
  const currentAdminId = session?.user.id ?? '';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Пользователи</h2>
      <Suspense
        fallback={<div className="text-muted-foreground py-8 text-center text-sm">Загрузка...</div>}
      >
        <UsersTable currentAdminId={currentAdminId} />
      </Suspense>
    </div>
  );
}
