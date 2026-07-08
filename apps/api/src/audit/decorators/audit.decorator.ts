import { SetMetadata } from '@nestjs/common';
import type { AuditEvent, User } from '@prisma/client';

/**
 * Минимальный структурный тип запроса для резолверов аудита. В проекте нет
 * augmented-типа FastifyRequest (используются inline-типы, см. auth.controller),
 * а `fastify` не является прямой зависимостью. Passport (jwt.strategy.validate)
 * кладёт в req.user полный Prisma-User; здесь перечислены только поля, которые
 * читают interceptor и резолверы.
 */
export interface AuditRequest {
  user?: User;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface AuditOptions {
  /** Событие при успешном выполнении хендлера. */
  event: AuditEvent;
  /** Событие при ошибке (например, LOGIN_FAILED). По умолчанию — event. */
  failureEvent?: AuditEvent;
  /** Тип целевой сущности ("User"). */
  targetType?: string;
  /** id целевой сущности. */
  target?: (req: AuditRequest) => string | undefined;
  /** Переопределение актора (например, для login до аутентификации). */
  actor?: (req: AuditRequest) => { id?: string; email?: string } | undefined;
  /** Доп. метаданные — ТОЛЬКО безопасные поля (никаких паролей/токенов). */
  metadata?: (req: AuditRequest) => Record<string, unknown> | undefined;
}

export const AUDIT_KEY = 'audit:options';

/** Декларативно помечает хендлер контроллера для записи в аудит-лог. */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);
