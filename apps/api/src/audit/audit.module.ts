import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { RolesGuard } from '../auth/guards/roles.guard';

import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [
    RolesGuard,
    AuditRepository,
    AuditService,
    // Глобальный interceptor: читает @Audit-метаданные хендлеров.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
