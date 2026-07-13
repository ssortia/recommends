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
    interestsDescription: string | null | undefined,
  ): Promise<PreferencesResult> {
    // undefined (поле не передано в запросе) трактуется так же, как явный сброс в null.
    const preferences = await this.preferencesRepository.upsert(
      userId,
      interestsDescription ?? null,
    );

    return { interestsDescription: preferences.interestsDescription };
  }
}
