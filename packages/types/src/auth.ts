import { z } from 'zod';

export const RoleSchema = z.enum(['USER', 'ADMIN']);
export type Role = z.infer<typeof RoleSchema>;

export const LoginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;

export const RegisterDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;

export const TokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type Tokens = z.infer<typeof TokensSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: RoleSchema,
  emailVerified: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof UserSchema>;

export const UpdateRoleDtoSchema = z.object({ role: RoleSchema });
export type UpdateRoleDto = z.infer<typeof UpdateRoleDtoSchema>;

export const RefreshTokenDtoSchema = z.object({
  refreshToken: z.string(),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenDtoSchema>;

// Подтверждение email по одноразовому токену из письма.
export const VerifyEmailDtoSchema = z.object({
  token: z.string(),
});

export type VerifyEmailDto = z.infer<typeof VerifyEmailDtoSchema>;

// Повторная отправка письма верификации (по email, без раскрытия существования).
export const ResendVerificationDtoSchema = z.object({
  email: z.string().email(),
});

export type ResendVerificationDto = z.infer<typeof ResendVerificationDtoSchema>;

// Запрос сброса пароля (по email, ответ одинаков независимо от существования).
export const ForgotPasswordDtoSchema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDtoSchema>;

// Установка нового пароля по одноразовому токену из письма.
export const ResetPasswordDtoSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordDtoSchema>;
