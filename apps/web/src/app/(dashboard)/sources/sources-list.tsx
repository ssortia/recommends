'use client';

import { type MouseEvent, useState } from 'react';

import type { LucideIcon } from 'lucide-react';
import { Rss, Send, Trash2 } from 'lucide-react';

import type { SourceType } from '@repo/types';

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

// Иконка-заглушка по типу источника — используется, когда favicon не сохранён
// или не загрузился (см. onError у <img> в SourceIcon).
const FALLBACK_ICON_BY_TYPE: Record<SourceType, LucideIcon> = {
  RSS: Rss,
  TELEGRAM: Send,
};

// Подпись типа источника рядом с названием.
const TYPE_LABEL: Record<SourceType, string> = {
  RSS: 'RSS',
  TELEGRAM: 'Telegram',
};

// h-11 (44px) — сумма высот строки названия (text-base/leading-6 = 24px) и ссылки
// (text-sm/leading-5 = 20px), чтобы иконка визуально уравновешивала весь текстовый блок.
const ICON_SIZE_CLASS = 'h-11 w-11 shrink-0';

function SourceIcon({ faviconUrl, type }: { faviconUrl: string | null; type: SourceType }) {
  const [imageFailed, setImageFailed] = useState(false);
  const FallbackIcon = FALLBACK_ICON_BY_TYPE[type];

  if (!faviconUrl || imageFailed) {
    return (
      <FallbackIcon
        className={`text-muted-foreground p-2 ${ICON_SIZE_CLASS}`}
        aria-hidden
        data-testid="source-icon-fallback"
      />
    );
  }

  return (
    // favicon-URL произвольного внешнего домена (сайт RSS-источника) — next/image требует
    // заранее известный allowlist доменов, поэтому используем обычный <img>
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={faviconUrl}
      alt=""
      data-testid="source-icon-favicon"
      className={`rounded-md object-contain ${ICON_SIZE_CLASS}`}
      onError={() => setImageFailed(true)}
    />
  );
}

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
            <div className="flex items-center gap-3">
              <SourceIcon faviconUrl={entry.source.faviconUrl} type={entry.source.type} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{entry.source.title}</span>
                  <span className="text-muted-foreground rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none">
                    {TYPE_LABEL[entry.source.type]}
                  </span>
                </div>
                <div className="text-muted-foreground text-sm">{entry.source.url}</div>
              </div>
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
                onClick={() => {
                  // Сбрасываем состояние прошлой мутации, иначе ошибка удаления
                  // источника A задержится и покажется при открытии диалога для источника B.
                  deleteSource.reset();
                  setPendingDeleteId(entry.source.id);
                }}
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
          if (!open) {
            setPendingDeleteId(null);
            deleteSource.reset();
          }
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
