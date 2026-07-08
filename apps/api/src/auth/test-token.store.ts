import { Injectable } from '@nestjs/common';
import type { VerificationTokenType } from '@prisma/client';

import { getEnv } from '../config/env';

/**
 * In-memory хранилище последнего выпущенного plain-токена для e2e-тестов.
 * В БД хранится только sha256-хэш, поэтому достать токен оттуда нельзя —
 * захватываем его в памяти в момент выпуска письма. Активно только при NODE_ENV=test.
 */
@Injectable()
export class TestTokenStore {
  private readonly tokens = new Map<string, string>();

  private get enabled(): boolean {
    return getEnv().NODE_ENV === 'test';
  }

  record(email: string, type: VerificationTokenType, token: string): void {
    if (!this.enabled) return;
    this.tokens.set(this.key(email, type), token);
  }

  getLast(email: string, type: VerificationTokenType): string | undefined {
    if (!this.enabled) return undefined;
    return this.tokens.get(this.key(email, type));
  }

  private key(email: string, type: VerificationTokenType): string {
    return `${email}:${type}`;
  }
}
