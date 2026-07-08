import { createHash } from 'node:crypto';

// env читается лениво в getEnv; задаём переменные до импорта сервиса.
process.env['DATABASE_URL'] = 'postgresql://u:p@localhost:5432/db';
process.env['JWT_SECRET'] = 'x'.repeat(32);
process.env['JWT_REFRESH_SECRET'] = 'y'.repeat(32);
process.env['EMAIL_VERIFICATION_TTL'] = '24h';
process.env['PASSWORD_RESET_TTL'] = '1h';

import type { VerificationRepository } from './verification.repository';
import { VerificationService } from './verification.service';

const sha256 = (token: string) => createHash('sha256').update(token).digest('hex');

describe('VerificationService', () => {
  let repository: {
    create: jest.Mock;
    findByTokenHash: jest.Mock;
    deleteByUserAndType: jest.Mock;
    deleteByTokenHashAndType: jest.Mock;
  };
  let service: VerificationService;

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
      findByTokenHash: jest.fn(),
      deleteByUserAndType: jest.fn().mockResolvedValue(undefined),
      deleteByTokenHashAndType: jest.fn().mockResolvedValue(1),
    };
    service = new VerificationService(repository as unknown as VerificationRepository);
  });

  describe('issue', () => {
    it('инвалидирует старые токены того же типа перед выпуском нового', async () => {
      await service.issue('u1', 'EMAIL_VERIFICATION');
      expect(repository.deleteByUserAndType).toHaveBeenCalledWith('u1', 'EMAIL_VERIFICATION');
    });

    it('инвалидирует старые токены до создания нового (порядок вызовов)', async () => {
      const order: string[] = [];
      repository.deleteByUserAndType.mockImplementation(async () => {
        order.push('delete');
      });
      repository.create.mockImplementation(async () => {
        order.push('create');
        return { id: 't1' };
      });
      await service.issue('u1', 'EMAIL_VERIFICATION');
      expect(order).toEqual(['delete', 'create']);
    });

    it('сохраняет sha256-хэш токена (не plain) и возвращает plain-токен', async () => {
      const token = await service.issue('u1', 'EMAIL_VERIFICATION');
      const createArg = repository.create.mock.calls[0][0];
      expect(createArg.tokenHash).toBe(sha256(token));
      expect(createArg.tokenHash).not.toBe(token);
      expect(createArg.user).toEqual({ connect: { id: 'u1' } });
      expect(createArg.type).toBe('EMAIL_VERIFICATION');
    });

    it('вычисляет expiresAt из TTL соответствующего типа', async () => {
      const before = Date.now();
      await service.issue('u1', 'PASSWORD_RESET');
      const { expiresAt } = repository.create.mock.calls[0][0] as { expiresAt: Date };
      // PASSWORD_RESET_TTL = 1h
      const delta = expiresAt.getTime() - before;
      expect(delta).toBeGreaterThan(3600 * 1000 - 5000);
      expect(delta).toBeLessThan(3600 * 1000 + 5000);
    });
  });

  describe('consume', () => {
    it('успех: возвращает userId и удаляет токен (одноразовость)', async () => {
      repository.findByTokenHash.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 60_000),
      });
      const userId = await service.consume('plain', 'EMAIL_VERIFICATION');
      expect(userId).toBe('u1');
      expect(repository.findByTokenHash).toHaveBeenCalledWith(sha256('plain'));
      // Погашение атомарным удалением по хэшу+типу.
      expect(repository.deleteByTokenHashAndType).toHaveBeenCalledWith(
        sha256('plain'),
        'EMAIL_VERIFICATION',
      );
    });

    it('отклоняет несуществующий (invalid) токен', async () => {
      repository.findByTokenHash.mockResolvedValue(null);
      await expect(service.consume('plain', 'EMAIL_VERIFICATION')).rejects.toThrow('Invalid token');
      expect(repository.deleteByTokenHashAndType).not.toHaveBeenCalled();
    });

    it('отклоняет гонку: токен забрал параллельный запрос (count !== 1)', async () => {
      repository.findByTokenHash.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 60_000),
      });
      repository.deleteByTokenHashAndType.mockResolvedValue(0);
      await expect(service.consume('plain', 'EMAIL_VERIFICATION')).rejects.toThrow('Invalid token');
    });

    it('отклоняет токен другого типа', async () => {
      repository.findByTokenHash.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(service.consume('plain', 'EMAIL_VERIFICATION')).rejects.toThrow('Invalid token');
    });

    it('отклоняет просроченный токен и удаляет его', async () => {
      repository.findByTokenHash.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.consume('plain', 'EMAIL_VERIFICATION')).rejects.toThrow('Token expired');
      // Просроченный токен всё равно гасится (атомарное удаление по хэшу+типу).
      expect(repository.deleteByTokenHashAndType).toHaveBeenCalledWith(
        sha256('plain'),
        'EMAIL_VERIFICATION',
      );
    });

    it('отклоняет повторное использование (токен уже удалён → не найден)', async () => {
      repository.findByTokenHash
        .mockResolvedValueOnce({
          id: 't1',
          userId: 'u1',
          type: 'EMAIL_VERIFICATION',
          expiresAt: new Date(Date.now() + 60_000),
        })
        .mockResolvedValueOnce(null);

      await service.consume('plain', 'EMAIL_VERIFICATION');
      await expect(service.consume('plain', 'EMAIL_VERIFICATION')).rejects.toThrow('Invalid token');
    });
  });
});
