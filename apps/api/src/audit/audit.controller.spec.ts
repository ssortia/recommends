import { AuditController } from './audit.controller';
import type { AuditService } from './audit.service';
import type { ListAuditQueryDto } from './dto/list-audit-query.dto';

describe('AuditController', () => {
  let service: { findPage: jest.Mock };
  let controller: AuditController;

  beforeEach(() => {
    service = { findPage: jest.fn().mockResolvedValue({ items: [], total: 0 }) };
    controller = new AuditController(service as unknown as AuditService);
  });

  it('делегирует query в AuditService.findPage и возвращает результат', async () => {
    const query: ListAuditQueryDto = { event: 'LOGIN_FAILED', limit: 10 };
    const result = await controller.findPage(query);
    expect(service.findPage).toHaveBeenCalledWith(query);
    expect(result).toEqual({ items: [], total: 0 });
  });
});
