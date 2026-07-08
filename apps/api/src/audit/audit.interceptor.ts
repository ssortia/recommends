import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { catchError, tap, throwError } from 'rxjs';

import type { AuditRecordInput } from './audit.repository';
import { AuditService } from './audit.service';
import type { AuditOptions, AuditRequest } from './decorators/audit.decorator';
import { AUDIT_KEY } from './decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditOptions | undefined>(AUDIT_KEY, context.getHandler());
    // Хендлер не помечен @Audit — ничего не пишем.
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditRequest>();
    const base = this.buildBaseEntry(options, request);

    return next.handle().pipe(
      tap(() => {
        void this.auditService.record({ ...base, event: options.event, success: true });
      }),
      catchError((error: unknown) => {
        void this.auditService.record({
          ...base,
          event: options.failureEvent ?? options.event,
          success: false,
        });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Собирает общую часть записи из запроса. В metadata попадают только поля,
   * явно возвращённые резолвером options.metadata — тело запроса целиком
   * никогда не логируется (защита от утечки паролей/токенов).
   */
  private buildBaseEntry(
    options: AuditOptions,
    request: AuditRequest,
  ): Omit<AuditRecordInput, 'event' | 'success'> {
    // Актор по умолчанию — req.user (полный User от JwtAuthGuard);
    // для эндпоинтов без guard (login) берём из options.actor.
    const resolvedActor = options.actor?.(request);
    const actorId = resolvedActor?.id ?? request.user?.id ?? null;
    const actorEmail = resolvedActor?.email ?? request.user?.email ?? null;

    const rawUserAgent = request.headers['user-agent'];
    const userAgent = Array.isArray(rawUserAgent) ? rawUserAgent[0] : (rawUserAgent ?? null);

    return {
      actorId,
      actorEmail,
      targetId: options.target?.(request) ?? null,
      targetType: options.targetType ?? null,
      metadata: options.metadata?.(request) ?? null,
      ip: request.ip ?? null,
      userAgent: userAgent ?? null,
    };
  }
}
