import { Injectable, NotFoundException } from '@nestjs/common';

import { UserSourcesRepository } from '../sources/user-sources.repository';
import { PreferencesRepository } from './preferences.repository';
import { SourcePreferencesRepository } from './source-preferences.repository';

export interface PreferencesResult {
  interestsDescription: string | null;
}

@Injectable()
export class PreferencesService {
  constructor(
    private readonly preferencesRepository: PreferencesRepository,
    private readonly sourcePreferencesRepository: SourcePreferencesRepository,
    private readonly userSourcesRepository: UserSourcesRepository,
  ) {}

  async get(userId: string): Promise<PreferencesResult> {
    const preferences = await this.preferencesRepository.findByUserId(userId);

    // Запись создаётся лениво только при первом сохранении — см. Development Approach плана.
    return { interestsDescription: preferences?.interestsDescription ?? null };
  }

  async update(
    userId: string,
    data: { interestsDescription?: string | null },
  ): Promise<PreferencesResult> {
    // Партиальный PATCH: отсутствие ключа в data (поле не передано в запросе)
    // не трогает текущее значение; передаётся дальше репозиторию как есть —
    // см. PreferencesRepository.upsert.
    const preferences = await this.preferencesRepository.upsert(userId, data);

    return { interestsDescription: preferences.interestsDescription };
  }

  async getForSource(userId: string, sourceId: string): Promise<PreferencesResult> {
    await this.ensureSubscribed(userId, sourceId);

    const preferences = await this.sourcePreferencesRepository.findByUserAndSource(
      userId,
      sourceId,
    );

    // Запись создаётся лениво только при первом сохранении — см. Development Approach плана.
    return { interestsDescription: preferences?.interestsDescription ?? null };
  }

  async updateForSource(
    userId: string,
    sourceId: string,
    data: { interestsDescription?: string | null },
  ): Promise<PreferencesResult> {
    await this.ensureSubscribed(userId, sourceId);

    const preferences = await this.sourcePreferencesRepository.upsert(userId, sourceId, data);

    return { interestsDescription: preferences.interestsDescription };
  }

  private async ensureSubscribed(userId: string, sourceId: string): Promise<void> {
    const isSubscribed = await this.userSourcesRepository.exists(userId, sourceId);

    if (!isSubscribed) {
      throw new NotFoundException('Источник не найден среди подписок пользователя');
    }
  }
}
