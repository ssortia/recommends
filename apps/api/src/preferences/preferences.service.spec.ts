import type { UserPreferences } from '@prisma/client';

import type { PreferencesRepository } from './preferences.repository';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  let preferencesRepository: { findByUserId: jest.Mock; upsert: jest.Mock };
  let service: PreferencesService;

  beforeEach(() => {
    preferencesRepository = { findByUserId: jest.fn(), upsert: jest.fn() };
    service = new PreferencesService(preferencesRepository as unknown as PreferencesRepository);
  });

  describe('get', () => {
    it('возвращает interestsDescription из репозитория, если запись найдена', async () => {
      preferencesRepository.findByUserId.mockResolvedValue({
        interestsDescription: 'спорт',
      } as UserPreferences);

      const result = await service.get('u1');

      expect(result).toEqual({ interestsDescription: 'спорт' });
      expect(preferencesRepository.findByUserId).toHaveBeenCalledWith('u1');
    });

    it('возвращает { interestsDescription: null }, если записи нет', async () => {
      preferencesRepository.findByUserId.mockResolvedValue(null);

      const result = await service.get('u1');

      expect(result).toEqual({ interestsDescription: null });
    });
  });

  describe('update', () => {
    it('вызывает upsert репозитория и возвращает обновлённое значение', async () => {
      preferencesRepository.upsert.mockResolvedValue({
        interestsDescription: 'наука',
      } as UserPreferences);

      const result = await service.update('u1', { interestsDescription: 'наука' });

      expect(result).toEqual({ interestsDescription: 'наука' });
      expect(preferencesRepository.upsert).toHaveBeenCalledWith('u1', {
        interestsDescription: 'наука',
      });
    });

    it('передаёт пустую строку репозиторию как есть (не превращает в null)', async () => {
      preferencesRepository.upsert.mockResolvedValue({
        interestsDescription: '',
      } as UserPreferences);

      const result = await service.update('u1', { interestsDescription: '' });

      expect(result).toEqual({ interestsDescription: '' });
      expect(preferencesRepository.upsert).toHaveBeenCalledWith('u1', {
        interestsDescription: '',
      });
    });

    it('сбрасывает поле в null при явной передаче null', async () => {
      preferencesRepository.upsert.mockResolvedValue({
        interestsDescription: null,
      } as UserPreferences);

      const result = await service.update('u1', { interestsDescription: null });

      expect(result).toEqual({ interestsDescription: null });
      expect(preferencesRepository.upsert).toHaveBeenCalledWith('u1', {
        interestsDescription: null,
      });
    });

    it('не трогает поле, если ключ interestsDescription отсутствует в data (партиальный PATCH)', async () => {
      preferencesRepository.upsert.mockResolvedValue({
        interestsDescription: 'прежнее значение',
      } as UserPreferences);

      await service.update('u1', {});

      expect(preferencesRepository.upsert).toHaveBeenCalledWith('u1', {});
    });
  });
});
