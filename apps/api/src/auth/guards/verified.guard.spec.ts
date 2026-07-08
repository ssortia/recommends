import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { User } from '@prisma/client';

import { VerifiedGuard } from './verified.guard';

describe('VerifiedGuard', () => {
  const guard = new VerifiedGuard();

  // Минимальный ExecutionContext с подменой request.user
  const contextWith = (user: Partial<User> | undefined): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('пропускает пользователя с подтверждённым email', () => {
    expect(guard.canActivate(contextWith({ emailVerified: true }))).toBe(true);
  });

  it('бросает ForbiddenException, если email не подтверждён', () => {
    expect(() => guard.canActivate(contextWith({ emailVerified: false }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contextWith({ emailVerified: false }))).toThrow(
      'EmailNotVerified',
    );
  });

  it('fail-closed: бросает ForbiddenException, если user отсутствует', () => {
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextWith(undefined))).toThrow('EmailNotVerified');
  });
});
