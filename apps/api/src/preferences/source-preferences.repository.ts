import { Injectable } from '@nestjs/common';
import type { SourcePreference } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Составной первичный ключ (userId, sourceId) не укладывается в BaseRepository
 * (рассчитан на findUnique/update/delete по id) — репозиторий написан отдельно,
 * в едином стиле с PreferencesRepository/UserSourcesRepository: только Prisma-вызовы.
 */
@Injectable()
export class SourcePreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserAndSource(userId: string, sourceId: string): Promise<SourcePreference | null> {
    return this.prisma.sourcePreference.findUnique({
      where: { userId_sourceId: { userId, sourceId } },
    });
  }

  /**
   * `data` — частичное обновление: если ключ `interestsDescription` отсутствует,
   * поле не трогается при update (партиальная PATCH-семантика), а при create
   * трактуется как отсутствие значения (null).
   */
  upsert(
    userId: string,
    sourceId: string,
    data: { interestsDescription?: string | null },
  ): Promise<SourcePreference> {
    const hasInterestsDescription = 'interestsDescription' in data;

    return this.prisma.sourcePreference.upsert({
      where: { userId_sourceId: { userId, sourceId } },
      create: {
        userId,
        sourceId,
        interestsDescription: hasInterestsDescription ? (data.interestsDescription ?? null) : null,
      },
      update: hasInterestsDescription
        ? { interestsDescription: data.interestsDescription ?? null }
        : {},
    });
  }
}
