import { z } from 'zod';

// Контракты раздела просмотра документации (docs/) в админке —
// источник истины, общий для API (DTO/Swagger) и web.

export const DocsFileMetaSchema = z.object({
  path: z.string(), // относительный путь от docs/ (например adr/012-api-error-format.md)
  name: z.string(),
  group: z.string(), // первый сегмент пути (adr/guides/plans) или 'root'
});
export type DocsFileMeta = z.infer<typeof DocsFileMetaSchema>;

export const DocsGroupSchema = z.object({
  group: z.string(),
  files: z.array(DocsFileMetaSchema),
});
export type DocsGroup = z.infer<typeof DocsGroupSchema>;

export const DocsTreeSchema = z.object({
  groups: z.array(DocsGroupSchema),
});
export type DocsTree = z.infer<typeof DocsTreeSchema>;

export const DocsFileContentSchema = z.object({
  path: z.string(),
  content: z.string(),
});
export type DocsFileContent = z.infer<typeof DocsFileContentSchema>;
