'use client';

import { type MouseEvent, useState } from 'react';

import { Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { useDeleteSource, useSources } from '../../../hooks/use-sources';

export function SourcesList() {
  const { data: entries = [], isLoading, isError } = useSources();
  const deleteSource = useDeleteSource();
  // Id источника, для которого открыт диалог подтверждения удаления (null — диалог закрыт).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const pendingEntry = entries.find((entry) => entry.source.id === pendingDeleteId);

  const handleConfirmDelete = (event: MouseEvent) => {
    // AlertDialogAction закрывает диалог автоматически по клику — предотвращаем это,
    // чтобы диалог оставался открытым до завершения мутации (и не закрывался при ошибке).
    event.preventDefault();
    if (!pendingDeleteId) return;
    deleteSource.mutate(pendingDeleteId, {
      onSuccess: () => setPendingDeleteId(null),
    });
  };

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
            <div className="flex items-center gap-3">
              <div className="text-muted-foreground text-xs">
                {entry.source.lastFetchedAt
                  ? `Обновлено: ${new Date(entry.source.lastFetchedAt).toLocaleString('ru-RU')}`
                  : 'Ещё не синхронизировано'}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Удалить подписку"
                onClick={() => setPendingDeleteId(entry.source.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить источник?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы отпишетесь от источника «{pendingEntry?.source.title}». Статьи этого источника
              больше не будут появляться в вашем списке.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteSource.isError && (
            <p className="text-destructive text-sm">
              Не удалось удалить источник. Попробуйте ещё раз.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSource.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={deleteSource.isPending} onClick={handleConfirmDelete}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
