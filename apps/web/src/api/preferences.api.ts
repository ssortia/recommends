import type { Preferences, UpdatePreferencesInput } from '@repo/types';

import { api } from '../lib/api';

/** Доменные функции для preferences-эндпоинтов. Без React, без хуков — чистые async-функции. */
export const preferencesApi = {
  get: (accessToken: string) => api.get<Preferences>('/preferences', { accessToken }),

  update: (
    interestsDescription: UpdatePreferencesInput['interestsDescription'],
    accessToken: string,
  ) => api.patch<Preferences>('/preferences', { interestsDescription }, { accessToken }),
};
