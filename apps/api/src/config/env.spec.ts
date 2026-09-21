import { DEV_SECRET_PLACEHOLDERS, envSchema } from './env';

const [DEV_JWT_SECRET, DEV_JWT_REFRESH_SECRET] = [...DEV_SECRET_PLACEHOLDERS];

const REAL_SECRET = 'a'.repeat(32);
const REAL_REFRESH_SECRET = 'b'.repeat(32);

// Схема парсится напрямую, минуя getEnv: он мемоизирует результат и завершает процесс при ошибке.
const parse = (overrides: Record<string, string>) =>
  envSchema.safeParse({
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: REAL_SECRET,
    JWT_REFRESH_SECRET: REAL_REFRESH_SECRET,
    ...overrides,
  });

const errorFields = (result: ReturnType<typeof parse>) =>
  result.success ? [] : Object.keys(result.error.flatten().fieldErrors);

describe('envSchema: dev-заглушки секретов', () => {
  it('отклоняет заглушки JWT-секретов при NODE_ENV=production', () => {
    const result = parse({
      NODE_ENV: 'production',
      JWT_SECRET: DEV_JWT_SECRET!,
      JWT_REFRESH_SECRET: DEV_JWT_REFRESH_SECRET!,
    });

    expect(result.success).toBe(false);
    expect(errorFields(result)).toEqual(
      expect.arrayContaining(['JWT_SECRET', 'JWT_REFRESH_SECRET']),
    );
  });

  it('отклоняет заглушку в одном поле, даже если второе заполнено реальным секретом', () => {
    const result = parse({
      NODE_ENV: 'production',
      JWT_SECRET: DEV_JWT_SECRET!,
    });

    expect(result.success).toBe(false);
    expect(errorFields(result)).toEqual(['JWT_SECRET']);
  });

  it('пропускает заглушки при NODE_ENV=development', () => {
    const result = parse({
      NODE_ENV: 'development',
      JWT_SECRET: DEV_JWT_SECRET!,
      JWT_REFRESH_SECRET: DEV_JWT_REFRESH_SECRET!,
    });

    expect(result.success).toBe(true);
  });

  it('пропускает заглушки при NODE_ENV=test', () => {
    const result = parse({
      NODE_ENV: 'test',
      JWT_SECRET: DEV_JWT_SECRET!,
      JWT_REFRESH_SECRET: DEV_JWT_REFRESH_SECRET!,
    });

    expect(result.success).toBe(true);
  });

  it.each(['development', 'test', 'production'])(
    'пропускает реальные секреты при NODE_ENV=%s',
    (nodeEnv) => {
      expect(parse({ NODE_ENV: nodeEnv }).success).toBe(true);
    },
  );
});
