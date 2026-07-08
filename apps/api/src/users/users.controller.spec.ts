import { Reflector } from '@nestjs/core';
import { AuditEvent } from '@prisma/client';

import { AUDIT_KEY, type AuditOptions } from '../audit/decorators/audit.decorator';

import { UsersController } from './users.controller';

describe('UsersController @Audit metadata', () => {
  const reflector = new Reflector();

  it('updateRole помечен USER_ROLE_CHANGED с targetType User', () => {
    const options = reflector.get<AuditOptions>(AUDIT_KEY, UsersController.prototype.updateRole);
    expect(options.event).toBe(AuditEvent.USER_ROLE_CHANGED);
    expect(options.targetType).toBe('User');
  });

  it('резолверы target/metadata берут id из params и role из body', () => {
    const options = reflector.get<AuditOptions>(AUDIT_KEY, UsersController.prototype.updateRole);
    const req = {
      params: { id: 'user42' },
      body: { role: 'ADMIN' },
      headers: {},
    };
    expect(options.target?.(req)).toBe('user42');
    expect(options.metadata?.(req)).toEqual({ role: 'ADMIN' });
  });
});
