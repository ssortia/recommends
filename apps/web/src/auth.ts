import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import type { Role } from '@repo/types';

import { authApi } from './api/auth.api';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type AccessTokenClaims = {
  sub?: string;
  email?: string;
  role?: Role;
  emailVerified?: boolean;
  exp?: number;
};

function decodeAccessToken(accessToken: string): AccessTokenClaims | null {
  try {
    return JSON.parse(
      Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString(),
    ) as AccessTokenClaims;
  } catch {
    return null;
  }
}

function getJwtExpiry(accessToken: string): number {
  return (decodeAccessToken(accessToken)?.exp ?? 0) * 1000;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        try {
          const tokens = await authApi.login(parsed.data);
          // Берём профиль из claims токена, а не из /users/me: тот маршрут
          // закрыт VerifiedGuard и недоступен до подтверждения email.
          const claims = decodeAccessToken(tokens.accessToken);
          if (!claims?.sub || !claims.email || !claims.role) return null;

          return {
            id: claims.sub,
            email: claims.email,
            role: claims.role,
            isEmailVerified: claims.emailVerified ?? false,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          accessToken?: string;
          refreshToken?: string;
          role?: Role;
          isEmailVerified?: boolean;
        };
        token['accessToken'] = u.accessToken;
        token['refreshToken'] = u.refreshToken;
        token['role'] = u.role;
        token['isEmailVerified'] = u.isEmailVerified ?? false;
        token['accessTokenExpiry'] = getJwtExpiry(u.accessToken ?? '');
        return token;
      }

      // Возвращаем токен без изменений, если он ещё действителен (буфер 30 сек)
      const expiry = token['accessTokenExpiry'] as number;
      if (expiry && Date.now() < expiry - 30_000) {
        return token;
      }

      // Access token истёк — пробуем обновить через refresh token
      try {
        const tokens = await authApi.refresh(token['refreshToken'] as string);
        token['accessToken'] = tokens.accessToken;
        token['refreshToken'] = tokens.refreshToken;
        token['accessTokenExpiry'] = getJwtExpiry(tokens.accessToken);
        // refresh перевыпускает токен из свежего состояния юзера — обновляем признак
        // подтверждения, чтобы баннер исчез после верификации без повторного входа.
        token['isEmailVerified'] = decodeAccessToken(tokens.accessToken)?.emailVerified ?? false;
        delete token['error'];
        return token;
      } catch {
        return { ...token, error: 'RefreshAccessTokenError' as const };
      }
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? '';
      session.user.role = (token['role'] as Role) ?? 'USER';
      session.user.isEmailVerified = (token['isEmailVerified'] as boolean) ?? false;
      (session as { accessToken?: string }).accessToken = token['accessToken'] as string;
      if (token['error']) {
        session.error = token['error'] as 'RefreshAccessTokenError';
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});
