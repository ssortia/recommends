'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import type { UpdatePreferencesInput } from '@repo/types';
import { UpdatePreferencesSchema } from '@repo/types';
import { TextareaField, ZodForm } from '@ssortia/shadcn-zod-bridge';
import { toast } from 'sonner';

import { usePreferences, useUpdatePreferences } from '../../../hooks/use-preferences';

export function InterestsDescriptionForm() {
  const { data: preferences, isLoading, isError } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: UpdatePreferencesInput) {
    setServerError(null);

    try {
      await updatePreferences.mutateAsync(data.interestsDescription);
      toast.success('Описание интересов сохранено');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setServerError('Описание слишком длинное: максимум 1000 символов');
      } else {
        setServerError('Не удалось сохранить описание интересов');
      }
    }
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Не удалось загрузить описание интересов. Обновите страницу, чтобы попробовать снова.
      </p>
    );
  }

  // Форма монтируется только после загрузки текущих предпочтений, чтобы
  // react-hook-form получил корректные defaultValues при инициализации
  if (isLoading || !preferences) {
    return null;
  }

  return (
    <ZodForm
      schema={UpdatePreferencesSchema}
      onSubmit={onSubmit}
      defaultValues={{ interestsDescription: preferences.interestsDescription ?? '' }}
      className="space-y-2"
    >
      <TextareaField
        name="interestsDescription"
        label="Описание интересов"
        placeholder="Расскажите, какие темы вам интересны — это поможет в подборе статей"
        rows={4}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updatePreferences.isPending}>
          {updatePreferences.isPending ? 'Сохранение...' : 'Сохранить'}
        </Button>
        {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      </div>
    </ZodForm>
  );
}
