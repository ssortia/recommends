import type { AddSourceResponse, Source } from '@repo/types';

import { api } from '../lib/api';

export interface UserSourceEntry {
  source: Source;
  createdAt: string;
}

/** Доменные функции для sources-эндпоинтов. Без React, без хуков — чистые async-функции. */
export const sourcesApi = {
  add: (url: string, accessToken: string) =>
    api.post<AddSourceResponse>('/sources', { url }, { accessToken }),

  list: (accessToken: string) => api.get<UserSourceEntry[]>('/sources', { accessToken }),

  remove: (sourceId: string, accessToken: string) =>
    api.delete<void>(`/sources/${sourceId}`, { accessToken }),
};
