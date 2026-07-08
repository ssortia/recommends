import { DocsViewer } from './docs-viewer';

// Роль ADMIN проверяется в admin/layout.tsx.
export default function AdminDocsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Документация</h2>
      <DocsViewer />
    </div>
  );
}
