import { Injectable } from '@nestjs/common';
import type { UserPreferences } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Поиск/upsert идут по userId (уникальному, но не первичному ключу) —
 * как и UserSourcesRepository, не укладывается в BaseRepository (id-центричный),
 * поэтому написан отдельно в едином стиле: только Prisma-вызовы.
 */
@Injectable()
export class PreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<UserPreferences | null> {
    return this.prisma.userPreferences.findUnique({ where: { userId } });
  }

  /**
   * `data` — частичное обновление: если ключ `interestsDescription` отсутствует,
   * поле не трогается при update (партиальная PATCH-семантика), а при create
   * трактуется как отсутствие значения (null).
   */
  upsert(userId: string, data: { interestsDescription?: string | null }): Promise<UserPreferences> {
    const hasInterestsDescription = 'interestsDescription' in data;

    return this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        interestsDescription: hasInterestsDescription ? (data.interestsDescription ?? null) : null,
      },
      update: hasInterestsDescription
        ? { interestsDescription: data.interestsDescription ?? null }
        : {},
    });
  }
}
