'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import type { Role } from '@repo/types';

import type { ListUsersParams } from '../api/users.api';
import { usersApi } from '../api/users.api';

/** Хук для получения списка пользователей с фильтрацией и сортировкой (только для ADMIN). */
export function useUsers(params?: ListUsersParams) {
  const { data: session } = useSession();
  return useQuery({
    // params входит в ключ — при смене фильтров/сортировки запрос перезапускается
    queryKey: ['users', params],
    queryFn: () => usersApi.list(session!.accessToken!, params),
    enabled: !!session?.accessToken,
  });
}

/** Хук для изменения роли пользователя с автоматической инвалидацией кэша. */
export function useUpdateRole() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      usersApi.updateRole(userId, role, session!.accessToken!),
    // Инвалидируем все запросы users (независимо от параметров)
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}
