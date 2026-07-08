import { Suspense } from 'react';

import { AddSourceForm } from './add-source-form';
import { SourcesList } from './sources-list';

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Источники</h2>
      <AddSourceForm />
      <Suspense
        fallback={<div className="text-muted-foreground py-8 text-center text-sm">Загрузка...</div>}
      >
        <SourcesList />
      </Suspense>
    </div>
  );
}
