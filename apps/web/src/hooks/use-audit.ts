'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import type { ListAuditParams } from '../api/audit.api';
import { auditApi } from '../api/audit.api';

/** Хук для получения журнала аудита с фильтрацией/сортировкой (только для ADMIN). */
export function useAuditLogs(params?: ListAuditParams) {
  const { data: session } = useSession();
  return useQuery({
    // params входит в ключ — при смене фильтров/пагинации запрос перезапускается
    queryKey: ['audit', params],
    queryFn: () => auditApi.list(session!.accessToken!, params),
    enabled: !!session?.accessToken,
  });
}
