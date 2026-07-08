import { Injectable } from '@nestjs/common';
import type { Prisma, Source, UserSource } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type UserSourceWithSource = UserSource & { source: Source };

/**
 * Составной первичный ключ (userId, sourceId) не укладывается в BaseRepository
 * (рассчитан на findUnique/update/delete по id) — репозиторий написан отдельно,
 * но в едином стиле: только Prisma-вызовы, без бизнес-исключений.
 */
@Injectable()
export class UserSourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async exists(userId: string, sourceId: string): Promise<boolean> {
    const subscription = await this.prisma.userSource.findUnique({
      where: { userId_sourceId: { userId, sourceId } },
    });
    return subscription !== null;
  }

  create(userId: string, sourceId: string, tx?: Prisma.TransactionClient): Promise<UserSource> {
    const client = tx ?? this.prisma;
    return client.userSource.create({ data: { userId, sourceId } });
  }

  findAllByUser(userId: string): Promise<UserSourceWithSource[]> {
    return this.prisma.userSource.findMany({
      where: { userId },
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
