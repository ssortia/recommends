import { z } from 'zod';

export const SourceTypeSchema = z.enum(['RSS']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const AddSourceSchema = z.object({
  url: z.string().url(),
});

export type AddSourceInput = z.infer<typeof AddSourceSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  type: SourceTypeSchema,
  url: z.string(),
  title: z.string(),
  lastFetchedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type Source = z.infer<typeof SourceSchema>;

export const AddSourceResponseSchema = z.object({
  source: SourceSchema,
  articlesCount: z.number().int().nonnegative(),
});

export type AddSourceResponse = z.infer<typeof AddSourceResponseSchema>;
