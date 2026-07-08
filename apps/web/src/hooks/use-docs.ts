'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { docsApi } from '../api/docs.api';

/** Хук для получения дерева документации (только для ADMIN). */
export function useDocsTree() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['docs', 'tree'],
    queryFn: () => docsApi.tree(session!.accessToken!),
    enabled: !!session?.accessToken,
  });
}

/** Хук для получения содержимого конкретного файла документации. */
export function useDocFile(path: string | null) {
  const { data: session } = useSession();
  return useQuery({
    // path входит в ключ — при выборе другого файла запрос перезапускается
    queryKey: ['docs', 'file', path],
    queryFn: () => docsApi.file(session!.accessToken!, path!),
    enabled: !!session?.accessToken && !!path,
  });
}
