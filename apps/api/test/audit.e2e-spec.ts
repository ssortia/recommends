import type { ExecutionContext } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import request from 'supertest';

import { AuditController } from '../src/audit/audit.controller';
import { AuditService } from '../src/audit/audit.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';

/**
 * Проверяет реальную логику RolesGuard на GET /audit (403 USER / 200 ADMIN)
 * без БД и env: JwtAuthGuard замокан и подставляет текущего пользователя,
 * AuditService — заглушка. Тестируется именно доступ по роли.
 */
describe('AuditController (e2e) — доступ по роли', () => {
  let app: NestFastifyApplication;
  let currentUser: { id: string; role: Role };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        RolesGuard,
        { provide: AuditService, useValue: { findPage: async () => ({ items: [], total: 0 }) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('возвращает 403 для роли USER', async () => {
    currentUser = { id: 'user1', role: Role.USER };
    await request(app.getHttpServer()).get('/audit').expect(403);
  });

  it('возвращает 200 для роли ADMIN', async () => {
    currentUser = { id: 'admin1', role: Role.ADMIN };
    const res = await request(app.getHttpServer()).get('/audit').expect(200);
    expect(res.body).toEqual({ items: [], total: 0 });
  });
});
