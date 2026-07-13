import { z } from 'zod';

export const PreferencesSchema = z.object({
  interestsDescription: z.string().nullable(),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

export const UpdatePreferencesSchema = z.object({
  interestsDescription: z.string().max(1000).nullable().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;
