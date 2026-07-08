import { Reflector } from '@nestjs/core';
import { AuditEvent } from '@prisma/client';

import { AUDIT_KEY, type AuditOptions } from '../audit/decorators/audit.decorator';

import { AuthController } from './auth.controller';

describe('AuthController @Audit metadata', () => {
  const reflector = new Reflector();

  it('login помечен LOGIN_SUCCESS / LOGIN_FAILED', () => {
    const options = reflector.get<AuditOptions>(AUDIT_KEY, AuthController.prototype.login);
    expect(options.event).toBe(AuditEvent.LOGIN_SUCCESS);
    expect(options.failureEvent).toBe(AuditEvent.LOGIN_FAILED);
  });

  it('резолвер metadata логина возвращает только email, без password', () => {
    const options = reflector.get<AuditOptions>(AUDIT_KEY, AuthController.prototype.login);
    const req = {
      body: { email: 'a@b.com', password: 'secret-pw' },
      headers: {},
    };
    const metadata = options.metadata?.(req);
    expect(metadata).toEqual({ email: 'a@b.com' });
    expect(JSON.stringify(metadata)).not.toContain('secret-pw');

    // Актор резолвится из body (на login нет req.user).
    expect(options.actor?.(req)).toEqual({ email: 'a@b.com' });
  });

  it('logout помечен LOGOUT', () => {
    const options = reflector.get<AuditOptions>(AUDIT_KEY, AuthController.prototype.logout);
    expect(options.event).toBe(AuditEvent.LOGOUT);
  });

  it('verify-email помечен EMAIL_VERIFIED', () => {
    const options = reflector.get<AuditOptions>(AUDIT_KEY, AuthController.prototype.verifyEmail);
    expect(options.event).toBe(AuditEvent.EMAIL_VERIFIED);
  });

  it('resend-verification без @Audit (тихий, не раскрывает существование)', () => {
    const options = reflector.get<AuditOptions>(
      AUDIT_KEY,
      AuthController.prototype.resendVerification,
    );
    expect(options).toBeUndefined();
  });

  it('forgot-password помечен PASSWORD_RESET_REQUESTED и логирует только email', () => {
    const options = reflector.get<AuditOptions>(AUDIT_KEY, AuthController.prototype.forgotPassword);
    expect(options.event).toBe(AuditEvent.PASSWORD_RESET_REQUESTED);

    // metadata содержит только whitelisted email — не раскрывает существование.
    const metadata = options.metadata?.({ body: { email: 'a@b.com' }, headers: {} });
    expect(metadata).toEqual({ email: 'a@b.com' });
  });

  it('reset-password помечен PASSWORD_RESET_COMPLETED и не логирует пароль', () => {
    const options = reflector.get<AuditOptions>(AUDIT_KEY, AuthController.prototype.resetPassword);
    expect(options.event).toBe(AuditEvent.PASSWORD_RESET_COMPLETED);

    // По умолчанию metadata не задана — токен и пароль не попадают в лог.
    expect(options.metadata).toBeUndefined();
  });
});
