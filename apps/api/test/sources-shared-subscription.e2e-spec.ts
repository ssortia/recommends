import type { ExecutionContext } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import type { Role } from '@prisma/client';
import request from 'supertest';

import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { VerifiedGuard } from '../src/auth/guards/verified.guard';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SourcesModule } from '../src/sources/sources.module';

/**
 * Ключевое свойство решения «Удаление источника» (docs/plans/completed/9-20260711-delete-source.md):
 * Source/Article общие между пользователями и не удаляются при отписке одного из них.
 * Гварды заменены на подстановку текущего пользователя — тест бьёт по реальному Postgres
 * и реальным репозиториям/сервису, но не гоняет полный auth-флоу (не относится к предмету теста).
 */
describe('Sources — общий Source при отписке одного из пользователей (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let currentUserId: string;

  const suffix = Date.now();
  const userAId = `user-a-${suffix}`;
  const userBId = `user-b-${suffix}`;
  const sourceId = `source-${suffix}`;
  const articleId = `article-${suffix}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, SourcesModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = { id: currentUserId };
          return true;
        },
      })
      .overrideGuard(VerifiedGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: { id: userAId, email: `a-${suffix}@example.com`, password: 'x', role: 'USER' as Role },
    });
    await prisma.user.create({
      data: { id: userBId, email: `b-${suffix}@example.com`, password: 'x', role: 'USER' as Role },
    });
    await prisma.source.create({
      data: {
        id: sourceId,
        type: 'RSS',
        url: `https://example.com/shared-${suffix}.xml`,
        title: 'Shared feed',
      },
    });
    await prisma.article.create({
      data: {
        id: articleId,
        sourceId,
        externalId: 'guid-1',
        title: 'Some article',
        url: `https://example.com/shared-${suffix}/article-1`,
      },
    });
    await prisma.userSource.create({ data: { userId: userAId, sourceId } });
    await prisma.userSource.create({ data: { userId: userBId, sourceId } });
  });

  afterAll(async () => {
    await prisma.userSource.deleteMany({ where: { sourceId } });
    await prisma.article.deleteMany({ where: { sourceId } });
    await prisma.source.deleteMany({ where: { id: sourceId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await app.close();
  });

  it('после отписки пользователя A источник и статья остаются у пользователя B', async () => {
    currentUserId = userAId;
    await request(app.getHttpServer()).delete(`/sources/${sourceId}`).expect(204);

    // Пользователь A отписан.
    const userASubscription = await prisma.userSource.findUnique({
      where: { userId_sourceId: { userId: userAId, sourceId } },
    });
    expect(userASubscription).toBeNull();

    // Пользователь B по-прежнему подписан.
    const userBSubscription = await prisma.userSource.findUnique({
      where: { userId_sourceId: { userId: userBId, sourceId } },
    });
    expect(userBSubscription).not.toBeNull();

    // Source и Article не удалены из БД.
    const source = await prisma.source.findUnique({ where: { id: sourceId } });
    expect(source).not.toBeNull();
    const article = await prisma.article.findUnique({ where: { id: articleId } });
    expect(article).not.toBeNull();

    // Пользователь B по-прежнему видит источник в своём списке.
    currentUserId = userBId;
    const listRes = await request(app.getHttpServer()).get('/sources').expect(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: expect.objectContaining({ id: sourceId }) }),
      ]),
    );
  });

  it('повторная отписка пользователя A возвращает 404 (подписки уже нет)', async () => {
    currentUserId = userAId;
    await request(app.getHttpServer()).delete(`/sources/${sourceId}`).expect(404);
  });
});
