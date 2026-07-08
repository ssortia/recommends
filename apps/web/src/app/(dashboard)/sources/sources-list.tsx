'use client';

import { Card, CardContent } from '@/components/ui/card';

import { useSources } from '../../../hooks/use-sources';

export function SourcesList() {
  const { data: entries = [], isLoading, isError } = useSources();

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center text-sm">Загрузка...</div>;
  }

  if (isError) {
    return (
      <div className="text-destructive py-8 text-center text-sm">
        Не удалось загрузить источники
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        Источников пока нет — добавьте первую RSS-ленту выше
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.source.id}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <div className="font-medium">{entry.source.title}</div>
              <div className="text-muted-foreground text-sm">{entry.source.url}</div>
            </div>
            <div className="text-muted-foreground text-xs">
              {entry.source.lastFetchedAt
                ? `Обновлено: ${new Date(entry.source.lastFetchedAt).toLocaleString('ru-RU')}`
                : 'Ещё не синхронизировано'}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
