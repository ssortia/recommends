import type {
  Preferences,
  SourcePreference,
  UpdatePreferencesInput,
  UpdateSourcePreferenceInput,
} from '@repo/types';

import { api } from '../lib/api';

/** Доменные функции для preferences-эндпоинтов. Без React, без хуков — чистые async-функции. */
export const preferencesApi = {
  get: (accessToken: string) => api.get<Preferences>('/preferences', { accessToken }),

  update: (
    interestsDescription: UpdatePreferencesInput['interestsDescription'],
    accessToken: string,
  ) => api.patch<Preferences>('/preferences', { interestsDescription }, { accessToken }),

  getForSource: (sourceId: string, accessToken: string) =>
    api.get<SourcePreference>(`/preferences/sources/${sourceId}`, { accessToken }),

  updateForSource: (
    sourceId: string,
    interestsDescription: UpdateSourcePreferenceInput['interestsDescription'],
    accessToken: string,
  ) =>
    api.patch<SourcePreference>(
      `/preferences/sources/${sourceId}`,
      { interestsDescription },
      { accessToken },
    ),
};
