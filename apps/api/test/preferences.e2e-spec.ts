import type { ExecutionContext } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import type { Role } from '@prisma/client';
import request from 'supertest';

import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../src/auth/guards/verified.guard';
import { PreferencesModule } from '../src/preferences/preferences.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Прогоняет /preferences через реальный ValidationPipe (whitelist + forbidNonWhitelisted +
 * transform), как в проде (см. main.ts) — юнит-тесты сервиса/контроллера этот слой не покрывают.
 * Гварды заменены на подстановку текущего пользователя, как в
 * sources-shared-subscription.e2e-spec.ts — auth-флоу не относится к предмету теста.
 */
describe('Preferences (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const userId = `user-preferences-${suffix}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, PreferencesModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = { id: userId };
          return true;
        },
      })
      .overrideGuard(VerifiedGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    await prisma.user.create({
      data: {
        id: userId,
        email: `preferences-${suffix}@example.com`,
        password: 'x',
        role: 'USER' as Role,
      },
    });
  });

  afterAll(async () => {
    await prisma.userPreferences.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('GET возвращает interestsDescription: null, если записи ещё нет', async () => {
    const res = await request(app.getHttpServer()).get('/preferences').expect(200);
    expect(res.body).toEqual({ interestsDescription: null });
  });

  it('PATCH с валидным текстом создаёт запись и возвращает её', async () => {
    const res = await request(app.getHttpServer())
      .patch('/preferences')
      .send({ interestsDescription: 'космос и биология' })
      .expect(200);
    expect(res.body).toEqual({ interestsDescription: 'космос и биология' });

    const getRes = await request(app.getHttpServer()).get('/preferences').expect(200);
    expect(getRes.body).toEqual({ interestsDescription: 'космос и биология' });
  });

  it('PATCH с текстом длиннее 1000 символов отклоняется ValidationPipe с 400', async () => {
    await request(app.getHttpServer())
      .patch('/preferences')
      .send({ interestsDescription: 'a'.repeat(1001) })
      .expect(400);
  });

  it('PATCH с текстом ровно в 1000 символов проходит валидацию', async () => {
    const value = 'a'.repeat(1000);
    const res = await request(app.getHttpServer())
      .patch('/preferences')
      .send({ interestsDescription: value })
      .expect(200);
    expect(res.body).toEqual({ interestsDescription: value });
  });

  it('PATCH с лишним полем отклоняется ValidationPipe с 400 (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .patch('/preferences')
      .send({ interestsDescription: 'ok', extraField: 'not allowed' })
      .expect(400);
  });

  it('PATCH с null сбрасывает поле', async () => {
    const res = await request(app.getHttpServer())
      .patch('/preferences')
      .send({ interestsDescription: null })
      .expect(200);
    expect(res.body).toEqual({ interestsDescription: null });
  });

  it('PATCH без поля interestsDescription не трогает текущее значение (партиальный PATCH)', async () => {
    await request(app.getHttpServer())
      .patch('/preferences')
      .send({ interestsDescription: 'сохранённое значение' })
      .expect(200);

    await request(app.getHttpServer()).patch('/preferences').send({}).expect(200);

    const getRes = await request(app.getHttpServer()).get('/preferences').expect(200);
    expect(getRes.body).toEqual({ interestsDescription: 'сохранённое значение' });
  });

  describe('/preferences/sources/:sourceId', () => {
    const sourceId = `source-preferences-${suffix}`;
    const otherSourceId = `source-preferences-other-${suffix}`;

    beforeAll(async () => {
      await prisma.source.createMany({
        data: [
          { id: sourceId, type: 'RSS', url: `https://example.com/${sourceId}.xml`, title: 'S1' },
          {
            id: otherSourceId,
            type: 'RSS',
            url: `https://example.com/${otherSourceId}.xml`,
            title: 'S2',
          },
        ],
      });
      // Подписка только на sourceId — otherSourceId остаётся неподписанным для 404-кейса.
      await prisma.userSource.create({ data: { userId, sourceId } });
    });

    afterAll(async () => {
      await prisma.sourcePreference.deleteMany({ where: { userId } });
      await prisma.userSource.deleteMany({ where: { userId } });
      await prisma.source.deleteMany({ where: { id: { in: [sourceId, otherSourceId] } } });
    });

    it('GET возвращает 404, если пользователь не подписан на источник', async () => {
      await request(app.getHttpServer()).get(`/preferences/sources/${otherSourceId}`).expect(404);
    });

    it('PATCH возвращает 404, если пользователь не подписан на источник', async () => {
      await request(app.getHttpServer())
        .patch(`/preferences/sources/${otherSourceId}`)
        .send({ interestsDescription: 'ok' })
        .expect(404);
    });

    it('GET возвращает interestsDescription: null для подписанного источника без записи', async () => {
      const res = await request(app.getHttpServer())
        .get(`/preferences/sources/${sourceId}`)
        .expect(200);
      expect(res.body).toEqual({ interestsDescription: null });
    });

    it('PATCH с текстом длиннее 1000 символов отклоняется ValidationPipe с 400', async () => {
      await request(app.getHttpServer())
        .patch(`/preferences/sources/${sourceId}`)
        .send({ interestsDescription: 'a'.repeat(1001) })
        .expect(400);
    });

    it('PATCH с валидным текстом создаёт запись и возвращает её', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/preferences/sources/${sourceId}`)
        .send({ interestsDescription: 'только про этот источник' })
        .expect(200);
      expect(res.body).toEqual({ interestsDescription: 'только про этот источник' });

      const getRes = await request(app.getHttpServer())
        .get(`/preferences/sources/${sourceId}`)
        .expect(200);
      expect(getRes.body).toEqual({ interestsDescription: 'только про этот источник' });
    });
  });
});
