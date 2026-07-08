import type { DefaultSession } from 'next-auth';

import type { Role } from '@repo/types';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: 'RefreshAccessTokenError';
    user: {
      id: string;
      role: Role;
      // Не `emailVerified`: это имя зарезервировано next-auth под `Date | null`,
      // слияние деклараций дало бы конфликт типов.
      isEmailVerified: boolean;
    } & DefaultSession['user'];
  }
}
