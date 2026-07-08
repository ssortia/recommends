import { z } from 'zod';

// Длительность TTL: число + единица (s/m/h/d/w). Валидируем строго, чтобы опечатка
// падала на старте, а не приводила к молчаливому fallback при парсинге длительности.
const durationSchema = z.string().regex(/^\d+[smhdw]$/, 'must match <number><s|m|h|d|w>, e.g. 24h');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    NEXTAUTH_URL: z.string().url().optional(),

    // Mailer
    MAIL_TRANSPORT: z.enum(['json', 'smtp']).default('json'),
    MAIL_FROM: z.string().email().default('no-reply@example.com'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

    // Базовый URL веб-приложения для ссылок в письмах.
    WEB_URL: z.string().url().default('http://localhost:3000'),

    // TTL одноразовых токенов email-флоу.
    EMAIL_VERIFICATION_TTL: durationSchema.default('24h'),
    PASSWORD_RESET_TTL: durationSchema.default('1h'),
  })
  .superRefine((env, ctx) => {
    // При реальном SMTP-транспорте поля подключения обязательны.
    if (env.MAIL_TRANSPORT === 'smtp') {
      for (const field of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] as const) {
        if (env[field] === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required when MAIL_TRANSPORT=smtp`,
          });
        }
      }
    }
  });

type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
      process.exit(1);
    }
    _env = result.data;
  }
  return _env;
}
