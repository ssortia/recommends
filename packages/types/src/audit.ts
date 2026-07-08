import { z } from 'zod';

// Source of truth для типов событий аудита. Prisma-enum AuditEvent зеркалит
// этот список (импортировать из пакета в schema.prisma нельзя — сверка вручную).
export const AuditEventSchema = z.enum([
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'USER_ROLE_CHANGED',
  'EMAIL_VERIFIED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
]);
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AuditLogSchema = z.object({
  id: z.string(),
  event: AuditEventSchema,
  success: z.boolean(),
  actorId: z.string().nullable(),
  actorEmail: z.string().nullable(),
  targetId: z.string().nullable(),
  targetType: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// Поля, по которым допустима сортировка журнала (единый источник истины).
export const AUDIT_SORTABLE_FIELDS = ['createdAt'] as const;
export type AuditSortableField = (typeof AUDIT_SORTABLE_FIELDS)[number];

export const ListAuditQuerySchema = z.object({
  actor: z.string().optional(), // поиск по actorEmail (contains) или точному actorId
  event: AuditEventSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});
export type ListAuditParams = z.infer<typeof ListAuditQuerySchema>;

export const AuditPageSchema = z.object({
  items: z.array(AuditLogSchema),
  total: z.number().int(),
});
export type AuditPage = z.infer<typeof AuditPageSchema>;
