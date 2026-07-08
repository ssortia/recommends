import { Injectable } from '@nestjs/common';
import type { Prisma, Source } from '@prisma/client';

import type { BaseModelDelegate } from '../common/repository/base.repository';
import { BaseRepository } from '../common/repository/base.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourcesRepository extends BaseRepository<
  Source,
  Prisma.SourceCreateInput,
  Prisma.SourceUpdateInput
> {
  constructor(private readonly prisma: PrismaService) {
    // Каст необходим: Prisma-делегаты используют сложные условные дженерики,
    // которые TypeScript не может унифицировать с простым структурным интерфейсом.
    super(
      prisma.source as unknown as BaseModelDelegate<
        Source,
        Prisma.SourceCreateInput,
        Prisma.SourceUpdateInput
      >,
    );
  }

  findByUrl(url: string): Promise<Source | null> {
    return this.prisma.source.findUnique({ where: { url } });
  }

  // Отдельно от унаследованного create (работает через this.prisma) — вызывается
  // внутри $transaction из SourcesService.addSource, поэтому принимает tx-клиент явно.
  createWithinTransaction(
    tx: Prisma.TransactionClient,
    data: Prisma.SourceCreateInput,
  ): Promise<Source> {
    return tx.source.create({ data });
  }
}
