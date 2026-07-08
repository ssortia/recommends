import type { LoginDto, RegisterDto, Tokens } from '@repo/types';

import { api } from '../lib/api';

/** Доменные функции для auth-эндпоинтов. Без React, без хуков — чистые async-функции. */
export const authApi = {
  login: (data: LoginDto) => api.post<Tokens>('/auth/login', data),

  register: (data: RegisterDto) => api.post<Tokens>('/auth/register', data),

  refresh: (refreshToken: string) => api.post<Tokens>('/auth/refresh', { refreshToken }),

  logout: (accessToken: string) => api.post<void>('/auth/logout', {}, { accessToken }),

  verifyEmail: (token: string) => api.post<void>('/auth/verify-email', { token }),

  resendVerification: (email: string) => api.post<void>('/auth/resend-verification', { email }),

  forgotPassword: (email: string) => api.post<void>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<void>('/auth/reset-password', { token, password }),
};
