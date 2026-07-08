'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';

import type { Role, User } from '@repo/types';

import type { ListUsersParams } from '../../../api/users.api';
import { SORTABLE_FIELDS } from '../../../api/users.api';
import { Input } from '../../../components/ui/input';
import { useUsers } from '../../../hooks/use-users';

import { RoleSelect } from './role-select';

const columnHelper = createColumnHelper<User>();

/** Иконки направления сортировки */
function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc') return <span className="ml-1 text-xs">↑</span>;
  if (direction === 'desc') return <span className="ml-1 text-xs">↓</span>;
  return <span className="text-muted-foreground ml-1 text-xs">↕</span>;
}

/** Проверяет, что строка является допустимым полем сортировки. */
function isSortableField(value: string): value is NonNullable<ListUsersParams['sortBy']> {
  return (SORTABLE_FIELDS as readonly string[]).includes(value);
}

interface UsersTableProps {
  currentAdminId: string;
}

export function UsersTable({ currentAdminId }: UsersTableProps) {
  // Состояние фильтров
  const [emailInput, setEmailInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  // Состояние сортировки: undefined — не задана
  const [sortBy, setSortBy] = useState<ListUsersParams['sortBy']>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Дебаунс email-фильтра — не отправляем запрос на каждый символ
  const [debouncedEmail, setDebouncedEmail] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedEmail(emailInput), 400);
    return () => clearTimeout(id);
  }, [emailInput]);

  // Мемоизация params — стабилизирует queryKey в useUsers
  const params = useMemo<ListUsersParams>(
    () => ({
      email: debouncedEmail || undefined,
      role: roleFilter || undefined,
      sortBy,
      sortOrder: sortBy ? sortOrder : undefined,
    }),
    [debouncedEmail, roleFilter, sortBy, sortOrder],
  );

  const { data: users = [], isLoading, isError } = useUsers(params);

  /** Переключает сортировку: нет → asc → desc → нет */
  function toggleSort(field: NonNullable<ListUsersParams['sortBy']>) {
    if (sortBy !== field) {
      setSortBy(field);
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortBy(undefined);
    }
  }

  // useMemo — предотвращает пересборку таблицы при каждом рендере
  const columns = useMemo(
    () => [
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => (
          <span>
            {info.getValue()}
            {info.row.original.id === currentAdminId && (
              <span className="text-muted-foreground ml-2 text-xs">(вы)</span>
            )}
          </span>
        ),
      }),
      columnHelper.accessor('role', {
        header: 'Роль',
        cell: (info) => (
          <RoleSelect
            userId={info.row.original.id}
            currentRole={info.getValue()}
            currentAdminId={currentAdminId}
          />
        ),
      }),
      columnHelper.accessor('createdAt', {
        header: 'Дата регистрации',
        cell: (info) =>
          new Date(info.getValue()).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
      }),
    ],
    [currentAdminId],
  );

  const table = useReactTable({
    data: users,
    columns,
    // Сортировка и фильтрация выполняются на сервере
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Панель фильтров */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Поиск по email..."
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | '')}
          className="border-input bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm focus:ring-2"
        >
          <option value="">Все роли</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>

      {/* Таблица */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  const sortable = isSortableField(columnId);
                  const isActive = sortBy === columnId;
                  return (
                    <th
                      key={header.id}
                      className="cursor-pointer select-none px-4 py-3 text-left font-medium"
                      onClick={() => sortable && toggleSort(columnId)}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon direction={isActive ? sortOrder : false} />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              /* Скелетон при загрузке */
              Array.from({ length: 3 }).map((_, i) => (
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
                  Не удалось загрузить пользователей
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground px-4 py-6 text-center"
                >
                  Пользователи не найдены
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
    </div>
  );
}
