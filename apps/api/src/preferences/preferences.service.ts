import { Injectable } from '@nestjs/common';

import { PreferencesRepository } from './preferences.repository';

export interface PreferencesResult {
  interestsDescription: string | null;
}

@Injectable()
export class PreferencesService {
  constructor(private readonly preferencesRepository: PreferencesRepository) {}

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
}
