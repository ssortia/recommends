import { Injectable, Logger } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';

import type { AuditRecordInput, FindAuditPageParams } from './audit.repository';
import { AuditRepository } from './audit.repository';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  // Запись события «fire-and-forget»: сбой аудита не должен ломать основной запрос.
  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.auditRepository.record(input);
    } catch (error) {
      this.logger.error(`Не удалось записать событие аудита ${input.event}`, error);
    }
  }

  findPage(params: FindAuditPageParams): Promise<{ items: AuditLog[]; total: number }> {
    return this.auditRepository.findPage(params);
  }
}
