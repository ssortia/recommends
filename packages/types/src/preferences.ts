import { z } from 'zod';

export const PreferencesSchema = z.object({
  interestsDescription: z.string().nullable(),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

export const UpdatePreferencesSchema = z.object({
  interestsDescription: z.string().max(1000).nullable().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;

export const SourcePreferenceSchema = z.object({
  interestsDescription: z.string().nullable(),
});

export type SourcePreference = z.infer<typeof SourcePreferenceSchema>;

export const UpdateSourcePreferenceSchema = z.object({
  interestsDescription: z.string().max(1000).nullable().optional(),
});

export type UpdateSourcePreferenceInput = z.infer<typeof UpdateSourcePreferenceSchema>;
