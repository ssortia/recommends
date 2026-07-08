import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    // Воспроизводим prod-bootstrap (main.ts): глобальный фильтр ошибок + ValidationPipe,
    // чтобы e2e реально проверял единый формат тела ошибки поверх Fastify-пайплайна.
    app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('ошибка валидации (400) отдаётся в едином формате ApiErrorBody', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(400);

    expect(res.body).toMatchObject({
      statusCode: 400,
      message: 'Validation failed',
    });
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('HttpException (4xx) отдаётся в едином формате ApiErrorBody', async () => {
    // Неверные учётные данные -> UnauthorizedException ('Invalid credentials').
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'no-such-user@example.com', password: 'whatever123' })
      .expect(401);

    expect(res.body).toMatchObject({
      statusCode: 401,
      message: expect.any(String),
    });
    expect(res.body.details).toBeUndefined();
  });
});
