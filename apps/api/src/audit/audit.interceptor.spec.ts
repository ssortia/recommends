import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';

import { AuditInterceptor } from './audit.interceptor';
import type { AuditService } from './audit.service';
import type { AuditOptions } from './decorators/audit.decorator';

describe('AuditInterceptor', () => {
  let auditService: { record: jest.Mock };
  let reflector: { get: jest.Mock };
  let interceptor: AuditInterceptor;

  const buildContext = (request: unknown): ExecutionContext =>
    ({
      getHandler: () => () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const okHandler: CallHandler = { handle: () => of({ ok: true }) };

  beforeEach(() => {
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    reflector = { get: jest.fn() };
    interceptor = new AuditInterceptor(
      reflector as unknown as Reflector,
      auditService as unknown as AuditService,
    );
  });

  it('пропускает хендлер без @Audit (ничего не пишет)', async () => {
    reflector.get.mockReturnValue(undefined);
    await lastValueFrom(interceptor.intercept(buildContext({}), okHandler));
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('на успехе пишет options.event с success=true и актором из req.user', async () => {
    const options: AuditOptions = { event: 'LOGOUT' };
    reflector.get.mockReturnValue(options);
    const request = {
      user: { id: 'u1', email: 'u1@example.com' },
      ip: '10.0.0.1',
      headers: { 'user-agent': 'jest' },
    };

    await lastValueFrom(interceptor.intercept(buildContext(request), okHandler));

    expect(auditService.record).toHaveBeenCalledWith({
      event: 'LOGOUT',
      success: true,
      actorId: 'u1',
      actorEmail: 'u1@example.com',
      targetId: null,
      targetType: null,
      metadata: null,
      ip: '10.0.0.1',
      userAgent: 'jest',
    });
  });

  it('на ошибке пишет failureEvent с success=false и пробрасывает ошибку', async () => {
    const options: AuditOptions = { event: 'LOGIN_SUCCESS', failureEvent: 'LOGIN_FAILED' };
    reflector.get.mockReturnValue(options);
    const error = new Error('unauthorized');
    const errHandler: CallHandler = { handle: () => throwError(() => error) };

    await expect(
      lastValueFrom(interceptor.intercept(buildContext({ headers: {} }), errHandler)),
    ).rejects.toBe(error);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'LOGIN_FAILED', success: false }),
    );
  });

  it('логирует только whitelisted-поля из резолвера metadata (без password)', async () => {
    const options: AuditOptions = {
      event: 'LOGIN_SUCCESS',
      actor: (req) => ({ email: (req.body?.['email'] as string) ?? undefined }),
      metadata: (req) => ({ email: req.body?.['email'] }),
    };
    reflector.get.mockReturnValue(options);
    // У login нет req.user — актор должен резолвиться из body.email.
    const request = {
      body: { email: 'login@example.com', password: 'super-secret' },
      headers: {},
    };

    await lastValueFrom(interceptor.intercept(buildContext(request), okHandler));

    const recorded = auditService.record.mock.calls[0][0];
    expect(recorded.actorEmail).toBe('login@example.com');
    expect(recorded.actorId).toBeNull();
    expect(recorded.metadata).toEqual({ email: 'login@example.com' });
    expect(JSON.stringify(recorded)).not.toContain('super-secret');
  });

  it('резолвит target и targetType', async () => {
    const options: AuditOptions = {
      event: 'USER_ROLE_CHANGED',
      targetType: 'User',
      target: (req) => req.params?.['id'],
      metadata: (req) => ({ role: req.body?.['role'] }),
    };
    reflector.get.mockReturnValue(options);
    const request = {
      user: { id: 'admin1', email: 'admin@example.com' },
      params: { id: 'target9' },
      body: { role: 'ADMIN' },
      headers: {},
    };

    await lastValueFrom(interceptor.intercept(buildContext(request), okHandler));

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'USER_ROLE_CHANGED',
        targetId: 'target9',
        targetType: 'User',
        metadata: { role: 'ADMIN' },
      }),
    );
  });
});
