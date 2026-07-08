import type { Role, User } from '@repo/types';

import { api } from '../lib/api';

/** Поля, по которым поддерживается сортировка — единый источник истины для фронта. */
export const SORTABLE_FIELDS = ['email', 'role', 'createdAt'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

export interface ListUsersParams {
  email?: string;
  role?: Role;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
}

/** Доменные функции для users-эндпоинтов. Без React, без хуков — чистые async-функции. */
export const usersApi = {
  me: (accessToken: string) => api.get<User>('/users/me', { accessToken }),

  list: (accessToken: string, params?: ListUsersParams) =>
    api.get<User[]>('/users', {
      accessToken,
      params: params as Record<string, string | undefined>,
    }),

  updateRole: (userId: string, role: Role, accessToken: string) =>
    api.patch<User>(`/users/${userId}/role`, { role }, { accessToken }),
};
