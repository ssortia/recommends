import { NotFoundException } from '@nestjs/common';
import type { SourcePreference, UserPreferences } from '@prisma/client';

import type { UserSourcesRepository } from '../sources/user-sources.repository';
import type { PreferencesRepository } from './preferences.repository';
import { PreferencesService } from './preferences.service';
import type { SourcePreferencesRepository } from './source-preferences.repository';

describe('PreferencesService', () => {
  let preferencesRepository: { findByUserId: jest.Mock; upsert: jest.Mock };
  let sourcePreferencesRepository: { findByUserAndSource: jest.Mock; upsert: jest.Mock };
  let userSourcesRepository: { exists: jest.Mock };
  let service: PreferencesService;

  beforeEach(() => {
    preferencesRepository = { findByUserId: jest.fn(), upsert: jest.fn() };
    sourcePreferencesRepository = { findByUserAndSource: jest.fn(), upsert: jest.fn() };
    userSourcesRepository = { exists: jest.fn() };
    service = new PreferencesService(
      preferencesRepository as unknown as PreferencesRepository,
      sourcePreferencesRepository as unknown as SourcePreferencesRepository,
      userSourcesRepository as unknown as UserSourcesRepository,
    );
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

  describe('getForSource', () => {
    it('возвращает interestsDescription, если пользователь подписан и запись найдена', async () => {
      userSourcesRepository.exists.mockResolvedValue(true);
      sourcePreferencesRepository.findByUserAndSource.mockResolvedValue({
        interestsDescription: 'спорт',
      } as SourcePreference);

      const result = await service.getForSource('u1', 's1');

      expect(result).toEqual({ interestsDescription: 'спорт' });
      expect(userSourcesRepository.exists).toHaveBeenCalledWith('u1', 's1');
      expect(sourcePreferencesRepository.findByUserAndSource).toHaveBeenCalledWith('u1', 's1');
    });

    it('возвращает { interestsDescription: null }, если подписка есть, но записи нет', async () => {
      userSourcesRepository.exists.mockResolvedValue(true);
      sourcePreferencesRepository.findByUserAndSource.mockResolvedValue(null);

      const result = await service.getForSource('u1', 's1');

      expect(result).toEqual({ interestsDescription: null });
    });

    it('бросает NotFoundException, если пользователь не подписан на источник', async () => {
      userSourcesRepository.exists.mockResolvedValue(false);

      await expect(service.getForSource('u1', 's1')).rejects.toThrow(NotFoundException);
      expect(sourcePreferencesRepository.findByUserAndSource).not.toHaveBeenCalled();
    });
  });

  describe('updateForSource', () => {
    it('сохраняет описание через upsert, если пользователь подписан', async () => {
      userSourcesRepository.exists.mockResolvedValue(true);
      sourcePreferencesRepository.upsert.mockResolvedValue({
        interestsDescription: 'наука',
      } as SourcePreference);

      const result = await service.updateForSource('u1', 's1', {
        interestsDescription: 'наука',
      });

      expect(result).toEqual({ interestsDescription: 'наука' });
      expect(sourcePreferencesRepository.upsert).toHaveBeenCalledWith('u1', 's1', {
        interestsDescription: 'наука',
      });
    });

    it('передаёт partial-данные репозиторию как есть (ключ отсутствует)', async () => {
      userSourcesRepository.exists.mockResolvedValue(true);
      sourcePreferencesRepository.upsert.mockResolvedValue({
        interestsDescription: 'прежнее значение',
      } as SourcePreference);

      await service.updateForSource('u1', 's1', {});

      expect(sourcePreferencesRepository.upsert).toHaveBeenCalledWith('u1', 's1', {});
    });

    it('бросает NotFoundException, если пользователь не подписан на источник', async () => {
      userSourcesRepository.exists.mockResolvedValue(false);

      await expect(
        service.updateForSource('u1', 's1', { interestsDescription: 'наука' }),
      ).rejects.toThrow(NotFoundException);
      expect(sourcePreferencesRepository.upsert).not.toHaveBeenCalled();
    });
  });
});
