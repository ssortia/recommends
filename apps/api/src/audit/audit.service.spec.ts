import type { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let repository: { record: jest.Mock; findPage: jest.Mock };
  let service: AuditService;

  beforeEach(() => {
    repository = {
      record: jest.fn().mockResolvedValue({ id: 'log1' }),
      findPage: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    service = new AuditService(repository as unknown as AuditRepository);
  });

  describe('record', () => {
    it('делегирует запись в репозиторий', async () => {
      await service.record({ event: 'LOGOUT', success: true });
      expect(repository.record).toHaveBeenCalledWith({ event: 'LOGOUT', success: true });
    });

    it('проглатывает ошибку репозитория (fire-and-forget) и не пробрасывает её', async () => {
      repository.record.mockRejectedValueOnce(new Error('db down'));
      await expect(service.record({ event: 'LOGOUT', success: true })).resolves.toBeUndefined();
    });
  });

  describe('findPage', () => {
    it('делегирует выборку в репозиторий и возвращает результат', async () => {
      const result = await service.findPage({ event: 'LOGIN_SUCCESS' });
      expect(repository.findPage).toHaveBeenCalledWith({ event: 'LOGIN_SUCCESS' });
      expect(result).toEqual({ items: [], total: 0 });
    });
  });
});
