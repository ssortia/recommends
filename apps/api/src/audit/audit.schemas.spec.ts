import { AuditLogSchema, ListAuditQuerySchema } from '@repo/types';

describe('Audit Zod schemas', () => {
  const validLog = {
    id: 'clog123',
    event: 'LOGIN_SUCCESS',
    success: true,
    actorId: 'user1',
    actorEmail: 'user@example.com',
    targetId: null,
    targetType: null,
    metadata: { email: 'user@example.com' },
    ip: '127.0.0.1',
    userAgent: 'jest',
    createdAt: '2026-06-08T10:00:00.000Z',
  };

  it('парсит валидную запись и приводит createdAt к Date', () => {
    const parsed = AuditLogSchema.parse(validLog);
    expect(parsed.event).toBe('LOGIN_SUCCESS');
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });

  it('отклоняет неизвестный тип события', () => {
    expect(() => AuditLogSchema.parse({ ...validLog, event: 'UNKNOWN_EVENT' })).toThrow();
  });

  it('допускает nullable-поля актора/цели', () => {
    const parsed = AuditLogSchema.parse({
      ...validLog,
      actorId: null,
      actorEmail: null,
      metadata: null,
    });
    expect(parsed.actorId).toBeNull();
    expect(parsed.metadata).toBeNull();
  });

  describe('ListAuditQuerySchema', () => {
    it('принимает пустой объект (все фильтры опциональны)', () => {
      expect(ListAuditQuerySchema.parse({})).toEqual({});
    });

    it('приводит даты и валидирует sortOrder', () => {
      const parsed = ListAuditQuerySchema.parse({
        dateFrom: '2026-06-01T00:00:00.000Z',
        sortOrder: 'asc',
        limit: 50,
      });
      expect(parsed.dateFrom).toBeInstanceOf(Date);
      expect(parsed.sortOrder).toBe('asc');
    });

    it('отклоняет limit вне диапазона 1..100', () => {
      expect(() => ListAuditQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => ListAuditQuerySchema.parse({ limit: 101 })).toThrow();
    });
  });
});
