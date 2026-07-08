'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';

import { AuditEventSchema } from '@repo/types';

import type { AuditEvent, AuditLog, ListAuditParams } from '../../../api/audit.api';
import { Input } from '../../../components/ui/input';
import { useAuditLogs } from '../../../hooks/use-audit';

const columnHelper = createColumnHelper<AuditLog>();

const PAGE_SIZE = 20;

// Список типов событий для select-фильтра — из единого источника (@repo/types).
const AUDIT_EVENTS = AuditEventSchema.options;

function SortIcon({ direction }: { direction: 'asc' | 'desc' }) {
  return <span className="ml-1 text-xs">{direction === 'asc' ? '↑' : '↓'}</span>;
}

function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditTable() {
  // Фильтры
  const [actorInput, setActorInput] = useState('');
  const [eventFilter, setEventFilter] = useState<AuditEvent | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Сортировка по дате (единственное сортируемое поле)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  // Пагинация
  const [offset, setOffset] = useState(0);

  // Дебаунс фильтра по актору
  const [debouncedActor, setDebouncedActor] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedActor(actorInput), 400);
    return () => clearTimeout(id);
  }, [actorInput]);

  // При смене любого фильтра/сортировки возвращаемся на первую страницу
  useEffect(() => {
    setOffset(0);
  }, [debouncedActor, eventFilter, dateFrom, dateTo, sortOrder]);

  const params = useMemo<ListAuditParams>(
    () => ({
      actor: debouncedActor || undefined,
      event: eventFilter || undefined,
      // date-input даёт YYYY-MM-DD; конвертируем в ISO-границы суток
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
      sortOrder,
      limit: PAGE_SIZE,
      offset,
    }),
    [debouncedActor, eventFilter, dateFrom, dateTo, sortOrder, offset],
  );

  const { data, isLoading, isError } = useAuditLogs(params);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('createdAt', {
        header: 'Дата',
        cell: (info) => formatDateTime(info.getValue()),
      }),
      columnHelper.accessor('event', {
        header: 'Событие',
        cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'actor',
        header: 'Актор',
        cell: (info) => {
          const row = info.row.original;
          return row.actorEmail ?? row.actorId ?? '—';
        },
      }),
      columnHelper.display({
        id: 'target',
        header: 'Цель',
        cell: (info) => {
          const row = info.row.original;
          if (!row.targetId && !row.targetType) return '—';
          return `${row.targetType ?? ''} ${row.targetId ?? ''}`.trim();
        },
      }),
      columnHelper.accessor('success', {
        header: 'Результат',
        cell: (info) =>
          info.getValue() ? (
            <span className="text-green-600">✓</span>
          ) : (
            <span className="text-destructive">✗</span>
          ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: items,
    columns,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-4">
      {/* Панель фильтров */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Поиск по актору (email/id)..."
          value={actorInput}
          onChange={(e) => setActorInput(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value as AuditEvent | '')}
          className="border-input bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm focus:ring-2"
        >
          <option value="">Все события</option>
          {AUDIT_EVENTS.map((event) => (
            <option key={event} value={event}>
              {event}
            </option>
          ))}
        </select>
        <label className="text-muted-foreground flex items-center gap-1 text-sm">
          с
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border-input bg-background focus:ring-ring rounded-md border px-2 py-2 text-sm focus:ring-2"
          />
        </label>
        <label className="text-muted-foreground flex items-center gap-1 text-sm">
          по
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border-input bg-background focus:ring-ring rounded-md border px-2 py-2 text-sm focus:ring-2"
          />
        </label>
      </div>

      {/* Таблица */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isDateColumn = header.column.id === 'createdAt';
                  return (
                    <th
                      key={header.id}
                      className={`px-4 py-3 text-left font-medium ${
                        isDateColumn ? 'cursor-pointer select-none' : ''
                      }`}
                      onClick={() =>
                        isDateColumn && setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {isDateColumn && <SortIcon direction={sortOrder} />}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="bg-muted h-4 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={columns.length} className="text-destructive px-4 py-6 text-center">
                  Не удалось загрузить журнал
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  Записи не найдены
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total > 0
            ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} из ${total}`
            : 'Нет записей'}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
            className="border-input hover:bg-muted/50 rounded-md border px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Назад
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            className="border-input hover:bg-muted/50 rounded-md border px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Вперёд
          </button>
        </div>
      </div>
    </div>
  );
}
