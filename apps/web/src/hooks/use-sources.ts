'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { sourcesApi } from '../api/sources.api';

/** Хук для получения списка источников, на которые подписан текущий пользователь. */
export function useSources() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => sourcesApi.list(session!.accessToken!),
    enabled: !!session?.accessToken,
  });
}

/** Хук для добавления источника с автоматической инвалидацией списка. */
export function useAddSource() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => sourcesApi.add(url, session!.accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sources'] }),
  });
}
