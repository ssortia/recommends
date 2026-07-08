import type { DocsFileContent, DocsTree } from '@repo/types';

import { api } from '../lib/api';

export type { DocsFileContent, DocsFileMeta, DocsGroup, DocsTree } from '@repo/types';

/** Доменные функции для docs-эндпоинтов. Без React, без хуков. */
export const docsApi = {
  tree: (accessToken: string) => api.get<DocsTree>('/docs', { accessToken }),
  file: (accessToken: string, path: string) =>
    api.get<DocsFileContent>('/docs/file', { accessToken, params: { path } }),
};
