'use client';

import type { UpdatePreferencesInput } from '@repo/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { preferencesApi } from '../api/preferences.api';

/** Хук для получения текущих предпочтений (описания интересов) пользователя. */
export function usePreferences() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => preferencesApi.get(session!.accessToken!),
    enabled: !!session?.accessToken,
  });
}

/** Хук для обновления описания интересов с автоматической инвалидацией. */
export function useUpdatePreferences() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interestsDescription: UpdatePreferencesInput['interestsDescription']) =>
      preferencesApi.update(interestsDescription, session!.accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  });
}
