'use client';

import { capitalize } from '@repo/utils';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { DocsGroup } from '../../../api/docs.api';
import { useDocFile, useDocsTree } from '../../../hooks/use-docs';

// Компоненты рендера Markdown: проект без tailwind-typography,
// поэтому базовые стили задаём явными классами.
const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ ...props }) => <h1 className="mb-4 mt-6 text-2xl font-bold first:mt-0" {...props} />,
  h2: ({ ...props }) => <h2 className="mb-3 mt-6 text-xl font-semibold first:mt-0" {...props} />,
  h3: ({ ...props }) => <h3 className="mb-2 mt-5 text-lg font-semibold first:mt-0" {...props} />,
  h4: ({ ...props }) => <h4 className="mb-2 mt-4 text-base font-semibold first:mt-0" {...props} />,
  p: ({ ...props }) => <p className="my-3 leading-relaxed" {...props} />,
  ul: ({ ...props }) => <ul className="my-3 list-disc space-y-1 pl-6" {...props} />,
  ol: ({ ...props }) => <ol className="my-3 list-decimal space-y-1 pl-6" {...props} />,
  li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
  a: ({ ...props }) => <a className="text-primary underline" {...props} />,
  blockquote: ({ ...props }) => (
    <blockquote
      className="border-muted text-muted-foreground my-3 border-l-4 pl-4 italic"
      {...props}
    />
  ),
  code: ({ className, ...props }) => {
    // Инлайн-код не имеет языкового className от remark; блочный — имеет.
    const isBlock = className?.includes('language-');
    return isBlock ? (
      <code className={`${className ?? ''} font-mono text-sm`} {...props} />
    ) : (
      <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm" {...props} />
    );
  },
  pre: ({ ...props }) => (
    <pre className="bg-muted my-3 overflow-x-auto rounded-lg p-4 text-sm" {...props} />
  ),
  table: ({ ...props }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ ...props }) => (
    <th className="border-input bg-muted/50 border px-3 py-2 text-left font-medium" {...props} />
  ),
  td: ({ ...props }) => <td className="border-input border px-3 py-2" {...props} />,
  hr: ({ ...props }) => <hr className="border-input my-6" {...props} />,
};

// Для вложенных файлов (group/sub/.../name) показываем под-путь внутри группы,
// иначе одинаковые basename в разных подкаталогах визуально неразличимы.
function fileLabel(filePath: string, name: string, group: string): string {
  const withoutGroup = filePath.startsWith(`${group}/`)
    ? filePath.slice(group.length + 1)
    : filePath;
  return withoutGroup === name ? name : withoutGroup;
}

function FileTree({
  groups,
  selectedPath,
  onSelect,
}: {
  groups: DocsGroup[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <nav className="space-y-4">
      {groups.map((group) => (
        <div key={group.group}>
          <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
            {capitalize(group.group)}
          </h3>
          <ul className="space-y-0.5">
            {group.files.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => onSelect(file.path)}
                  className={`hover:bg-muted/50 w-full cursor-pointer truncate rounded-md px-2 py-1 text-left text-sm transition-colors ${
                    file.path === selectedPath ? 'bg-muted font-medium' : 'text-muted-foreground'
                  }`}
                  title={file.path}
                >
                  {fileLabel(file.path, file.name, group.group)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function FileContent({ path }: { path: string }) {
  const { data, isLoading, isError } = useDocFile(path);

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center text-sm">Загрузка...</div>;
  }

  if (isError || !data) {
    return (
      <div className="text-destructive py-8 text-center text-sm">Не удалось загрузить файл</div>
    );
  }

  return (
    <article className="max-w-none break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {data.content}
      </ReactMarkdown>
    </article>
  );
}

export function DocsViewer() {
  const { data, isLoading, isError } = useDocsTree();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center text-sm">Загрузка...</div>;
  }

  if (isError || !data) {
    return (
      <div className="text-destructive py-8 text-center text-sm">
        Не удалось загрузить дерево документации
      </div>
    );
  }

  if (data.groups.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">Документация не найдена</div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
      <aside className="md:border-r md:pr-4">
        <FileTree groups={data.groups} selectedPath={selectedPath} onSelect={setSelectedPath} />
      </aside>
      <section className="min-w-0">
        {selectedPath ? (
          <FileContent path={selectedPath} />
        ) : (
          <div className="text-muted-foreground py-8 text-center text-sm">
            Выберите файл для просмотра
          </div>
        )}
      </section>
    </div>
  );
}
