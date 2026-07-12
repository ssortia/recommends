'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import type { AddSourceInput } from '@repo/types';
import { AddSourceSchema } from '@repo/types';
import { TextField, ZodForm } from '@ssortia/shadcn-zod-bridge';

import { useAddSource } from '../../../hooks/use-sources';

export function AddSourceForm() {
  const addSource = useAddSource();
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(data: AddSourceInput) {
    setServerError(null);

    try {
      await addSource.mutateAsync(data.url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setServerError('Источник уже добавлен');
      } else if (err instanceof ApiError && err.status === 400) {
        setServerError('Не удалось добавить источник: проверьте формат ссылки или имени канала');
      } else {
        setServerError('Не удалось добавить источник');
      }
    }
  }

  return (
    // serverError вынесен из флекс-ряда с полем и кнопкой, чтобы его появление
    // не сдвигало кнопку — items-end выравнивает кнопку только по высоте поля
    <ZodForm schema={AddSourceSchema} onSubmit={onSubmit} className="space-y-2">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <TextField
            name="url"
            label="Источник"
            placeholder="https://example.com/feed.xml или @channel"
            required
          />
        </div>
        <Button type="submit" disabled={addSource.isPending}>
          {addSource.isPending ? 'Добавление...' : 'Добавить'}
        </Button>
      </div>
      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
    </ZodForm>
  );
}
