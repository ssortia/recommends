// Обязательные env подгружает setup-e2e.ts из корневого .env; для тестов жёстко
// фиксируем json-транспорт почты, чтобы письма не уходили наружу. Нужен реальный
// Postgres (docker compose, порт 5441) — без него тесты упадут на $connect.
process.env['MAIL_TRANSPORT'] = 'json';

import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MailerService } from '../src/mailer/mailer.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Сквозной e2e-флоу email-верификации и сброса пароля поверх реального Postgres.
 * Plain-токен (в БД хранится только sha256-хэш) перехватываем шпионом на
 * MailerService — это единственный способ узнать токен снаружи.
 */
describe('Email flow (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  // Шпионы возвращают захваченный plain-токен письма (второй аргумент send-методов).
  const verificationTokens: string[] = [];
  const resetTokens: string[] = [];

  // Уникальные адреса на прогон, чтобы тесты не конфликтовали с существующими данными.
  const suffix = Date.now();
  const userEmail = `verify-${suffix}@example.com`;
  const resetEmail = `reset-${suffix}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    // Воспроизводим prod-bootstrap (main.ts), чтобы ошибки шли в едином формате.
    app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    const mailer = app.get(MailerService);
    jest.spyOn(mailer, 'sendVerificationEmail').mockImplementation(async (_to, token) => {
      verificationTokens.push(token);
    });
    jest.spyOn(mailer, 'sendPasswordResetEmail').mockImplementation(async (_to, token) => {
      resetTokens.push(token);
    });

    prisma = app.get(PrismaService);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    // Чистим за собой: каскад на VerificationToken снимет связанные токены.
    await prisma.user.deleteMany({ where: { email: { in: [userEmail, resetEmail] } } });
    await app.close();
  });

  describe('верификация email', () => {
    let accessToken: string;

    it('регистрация инициирует письмо и логинит (профиль ещё не верифицирован)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: userEmail, password: 'password123' })
        .expect(201);

      accessToken = res.body.accessToken as string;
      expect(accessToken).toBeTruthy();
      expect(verificationTokens).toHaveLength(1);

      // /users/me защищён VerifiedGuard: неподтверждённый пользователь получает 403.
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('verify-email по токену переводит профиль в emailVerified: true', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: verificationTokens[0] })
        .expect(204);

      const me = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(me.body.emailVerified).toBe(true);
    });

    it('повторное использование уже погашенного токена отклоняется', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: verificationTokens[0] })
        .expect(400);
    });
  });

  describe('сброс пароля', () => {
    const oldPassword = 'oldpassword123';
    const newPassword = 'newpassword456';

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: resetEmail, password: oldPassword })
        .expect(201);
      // Сбрасываем счётчик verification-писем регистрации — нам важны reset-токены.
      resetTokens.length = 0;
    });

    it('forgot-password даёт одинаковый ответ для несуществующего и существующего email', async () => {
      const nonexistent = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: `nobody-${suffix}@example.com` })
        .expect(204);

      const existing = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: resetEmail })
        .expect(204);

      // Один и тот же статус и пустое тело — существование email не раскрывается.
      expect(nonexistent.body).toEqual(existing.body);
      // Письмо ушло только реальному пользователю.
      expect(resetTokens).toHaveLength(1);
    });

    it('reset-password по токену меняет пароль, после чего работает логин новым паролем', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetTokens[0], password: newPassword })
        .expect(204);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: resetEmail, password: newPassword })
        .expect(200);

      // Старый пароль больше не действует.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: resetEmail, password: oldPassword })
        .expect(401);
    });

    it('повторное использование reset-токена отклоняется и НЕ меняет пароль', async () => {
      const rejectedPassword = 'whatever12345';
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetTokens[0], password: rejectedPassword })
        .expect(400);

      // Отклонённая попытка не должна была изменить пароль: действует предыдущий newPassword.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: resetEmail, password: newPassword })
        .expect(200);
      // Отклонённое новое значение пароля не применилось.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: resetEmail, password: rejectedPassword })
        .expect(401);
    });
  });

  describe('валидация DTO новых эндпоинтов', () => {
    it('forgot-password отклоняет невалидный email', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('reset-password отклоняет запрос без токена', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ password: 'password123' })
        .expect(400);
    });

    it('reset-password отклоняет пароль короче 8 символов', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'sometoken', password: 'short' })
        .expect(400);
    });

    it('verify-email отклоняет запрос без токена', async () => {
      await request(app.getHttpServer()).post('/auth/verify-email').send({}).expect(400);
    });
  });
});
