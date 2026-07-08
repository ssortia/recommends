import { Injectable } from '@nestjs/common';
import type { AuditEvent, AuditLog } from '@prisma/client';
import { Prisma } from '@prisma/client';

import type { BaseModelDelegate } from '../common/repository/base.repository';
import { BaseRepository } from '../common/repository/base.repository';
import { PrismaService } from '../prisma/prisma.service';

/** Данные для записи события аудита. Только whitelisted-поля (без паролей/токенов). */
export interface AuditRecordInput {
  event: AuditEvent;
  success: boolean;
  actorId?: string | null;
  actorEmail?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Параметры выборки журнала (уже провалидированы DTO/Zod). */
export interface FindAuditPageParams {
  actor?: string;
  event?: AuditEvent;
  dateFrom?: Date;
  dateTo?: Date;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

@Injectable()
export class AuditRepository extends BaseRepository<
  AuditLog,
  Prisma.AuditLogCreateInput,
  Prisma.AuditLogUpdateInput
> {
  constructor(private readonly prisma: PrismaService) {
    // Каст необходим: Prisma-делегаты используют сложные условные дженерики,
    // которые TypeScript не унифицирует с простым структурным интерфейсом.
    super(
      prisma.auditLog as unknown as BaseModelDelegate<
        AuditLog,
        Prisma.AuditLogCreateInput,
        Prisma.AuditLogUpdateInput
      >,
    );
  }

  // Базовый create — protected; расширяем видимость до public для AuditService.
  record(input: AuditRecordInput): Promise<AuditLog> {
    return super.create(input as Prisma.AuditLogCreateInput);
  }

  // Нетривиальная выборка идёт мимо базового делегата (нет count/$transaction).
  async findPage(params: FindAuditPageParams): Promise<{ items: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (params.event) {
      where.event = params.event;
    }
    if (params.actor) {
      // Поиск по email (частичное совпадение) ИЛИ точному id актора.
      where.OR = [
        { actorEmail: { contains: params.actor, mode: 'insensitive' } },
        { actorId: params.actor },
      ];
    }
    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = params.dateFrom;
      if (params.dateTo) where.createdAt.lte = params.dateTo;
    }

    const take = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const skip = params.offset ?? 0;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: params.sortOrder ?? 'desc' },
        take,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
