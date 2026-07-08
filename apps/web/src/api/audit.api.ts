import type { AuditEvent, AuditPage } from '@repo/types';
import { AUDIT_SORTABLE_FIELDS } from '@repo/types';

import { api } from '../lib/api';

export type { AuditEvent, AuditLog, AuditPage } from '@repo/types';
export { AUDIT_SORTABLE_FIELDS };

export interface ListAuditParams {
  /** Поиск по актору: email (частичное) или точный id. */
  actor?: string;
  event?: AuditEvent;
  /** ISO-строки (значения из date-input). */
  dateFrom?: string;
  dateTo?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/** Сериализует параметры в query-строку (undefined-значения отбрасываются). */
function toQuery(params?: ListAuditParams): Record<string, string | undefined> {
  if (!params) return {};
  return {
    actor: params.actor || undefined,
    event: params.event,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    sortOrder: params.sortOrder,
    limit: params.limit?.toString(),
    offset: params.offset?.toString(),
  };
}

/** Доменные функции для audit-эндпоинтов. Без React, без хуков. */
export const auditApi = {
  list: (accessToken: string, params?: ListAuditParams) =>
    api.get<AuditPage>('/audit', { accessToken, params: toQuery(params) }),
};
