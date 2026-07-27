'use client';

import type { UpdatePreferencesInput, UpdateSourcePreferenceInput } from '@repo/types';
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

/** Хук для получения индивидуального описания интересов для конкретного источника. */
export function useSourcePreference(sourceId: string) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['preferences', 'source', sourceId],
    queryFn: () => preferencesApi.getForSource(sourceId, session!.accessToken!),
    enabled: !!session?.accessToken && !!sourceId,
  });
}

/** Хук для обновления индивидуального описания интересов источника с автоматической инвалидацией. */
export function useUpdateSourcePreference(sourceId: string) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interestsDescription: UpdateSourcePreferenceInput['interestsDescription']) =>
      preferencesApi.updateForSource(sourceId, interestsDescription, session!.accessToken!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['preferences', 'source', sourceId] }),
  });
}
