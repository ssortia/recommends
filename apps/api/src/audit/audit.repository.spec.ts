import type { PrismaService } from '../prisma/prisma.service';

import { AuditRepository } from './audit.repository';

describe('AuditRepository', () => {
  let prisma: {
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let repository: AuditRepository;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log1' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'log1' }]),
        count: jest.fn().mockResolvedValue(1),
      },
      // $transaction в коде получает массив промисов — резолвим их параллельно.
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    repository = new AuditRepository(prisma as unknown as PrismaService);
  });

  describe('record', () => {
    it('делегирует создание записи в prisma.auditLog.create', async () => {
      await repository.record({ event: 'LOGOUT', success: true, actorId: 'u1' });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: { event: 'LOGOUT', success: true, actorId: 'u1' },
      });
    });
  });

  describe('findPage', () => {
    it('применяет дефолты: orderBy createdAt desc, take 50, skip 0, пустой where', async () => {
      await repository.findPage({});
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('строит where по event', async () => {
      await repository.findPage({ event: 'LOGIN_FAILED' });
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({ event: 'LOGIN_FAILED' });
    });

    it('строит OR по актору (email contains | actorId eq)', async () => {
      await repository.findPage({ actor: 'alice' });
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
        OR: [{ actorEmail: { contains: 'alice', mode: 'insensitive' } }, { actorId: 'alice' }],
      });
    });

    it('строит диапазон дат createdAt gte/lte', async () => {
      const from = new Date('2026-06-01T00:00:00Z');
      const to = new Date('2026-06-08T00:00:00Z');
      await repository.findPage({ dateFrom: from, dateTo: to });
      expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
        createdAt: { gte: from, lte: to },
      });
    });

    it('ограничивает limit максимумом 100 и пробрасывает offset/sortOrder', async () => {
      await repository.findPage({ limit: 500, offset: 20, sortOrder: 'asc' });
      const args = prisma.auditLog.findMany.mock.calls[0][0];
      expect(args.take).toBe(100);
      expect(args.skip).toBe(20);
      expect(args.orderBy).toEqual({ createdAt: 'asc' });
    });

    it('возвращает { items, total }', async () => {
      const result = await repository.findPage({});
      expect(result).toEqual({ items: [{ id: 'log1' }], total: 1 });
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
