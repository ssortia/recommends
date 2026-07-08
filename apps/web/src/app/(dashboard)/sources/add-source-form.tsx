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
        setServerError('Не удалось получить RSS-ленту по указанному URL');
      } else {
        setServerError('Не удалось добавить источник');
      }
    }
  }

  return (
    <ZodForm schema={AddSourceSchema} onSubmit={onSubmit} className="flex items-start gap-3">
      <div className="flex-1">
        <TextField
          name="url"
          label="URL RSS-ленты"
          placeholder="https://example.com/feed.xml"
          required
        />
        {serverError && <p className="text-destructive mt-2 text-sm">{serverError}</p>}
      </div>
      <Button type="submit" disabled={addSource.isPending} className="mt-6">
        {addSource.isPending ? 'Добавление...' : 'Добавить'}
      </Button>
    </ZodForm>
  );
}
