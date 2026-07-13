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

  upsert(userId: string, interestsDescription: string | null): Promise<UserPreferences> {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, interestsDescription },
      update: { interestsDescription },
    });
  }
}
