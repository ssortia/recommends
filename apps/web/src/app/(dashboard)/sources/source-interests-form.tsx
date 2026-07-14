'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import type { UpdateSourcePreferenceInput } from '@repo/types';
import { UpdateSourcePreferenceSchema } from '@repo/types';
import { TextareaField, ZodForm } from '@ssortia/shadcn-zod-bridge';

import { useSourcePreference, useUpdateSourcePreference } from '../../../hooks/use-preferences';

interface SourceInterestsFormProps {
  sourceId: string;
}

/** Форма индивидуального описания интересов для конкретного источника (по образцу InterestsDescriptionForm). */
export function SourceInterestsForm({ sourceId }: SourceInterestsFormProps) {
  const { data: preference, isLoading, isError } = useSourcePreference(sourceId);
  const updatePreference = useUpdateSourcePreference(sourceId);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: UpdateSourcePreferenceInput) {
    setServerError(null);

    try {
      await updatePreference.mutateAsync(data.interestsDescription);
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
        Не удалось загрузить описание интересов источника. Обновите страницу, чтобы попробовать
        снова.
      </p>
    );
  }

  // Форма монтируется только после загрузки текущего значения, чтобы
  // react-hook-form получил корректные defaultValues при инициализации
  if (isLoading || !preference) {
    return null;
  }

  return (
    <ZodForm
      schema={UpdateSourcePreferenceSchema}
      onSubmit={onSubmit}
      defaultValues={{ interestsDescription: preference.interestsDescription ?? '' }}
      className="space-y-2"
    >
      <TextareaField
        name="interestsDescription"
        label="Интересы для этого источника"
        placeholder="Опишите, какие темы этого источника вам интересны — приоритетнее общего описания"
        rows={3}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={updatePreference.isPending}>
          {updatePreference.isPending ? 'Сохранение...' : 'Сохранить'}
        </Button>
        {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      </div>
    </ZodForm>
  );
}
