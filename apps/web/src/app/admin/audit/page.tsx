import { Suspense } from 'react';

import { AuditTable } from './audit-table';

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Аудит</h2>
      <Suspense
        fallback={<div className="text-muted-foreground py-8 text-center text-sm">Загрузка...</div>}
      >
        <AuditTable />
      </Suspense>
    </div>
  );
}
