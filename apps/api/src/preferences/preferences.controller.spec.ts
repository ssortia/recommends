import type { User } from '@prisma/client';

import { PreferencesController } from './preferences.controller';
import type { PreferencesService } from './preferences.service';

describe('PreferencesController', () => {
  let preferencesService: {
    get: jest.Mock;
    update: jest.Mock;
    getForSource: jest.Mock;
    updateForSource: jest.Mock;
  };
  let controller: PreferencesController;
  const user = { id: 'u1' } as User;

  beforeEach(() => {
    preferencesService = {
      get: jest.fn(),
      update: jest.fn(),
      getForSource: jest.fn(),
      updateForSource: jest.fn(),
    };
    controller = new PreferencesController(preferencesService as unknown as PreferencesService);
  });

  describe('get', () => {
    it('делегирует userId в PreferencesService.get', async () => {
      const result = { interestsDescription: 'спорт' };
      preferencesService.get.mockResolvedValue(result);

      const response = await controller.get(user);

      expect(response).toEqual(result);
      expect(preferencesService.get).toHaveBeenCalledWith('u1');
    });
  });

  describe('update', () => {
    it('делегирует userId и interestsDescription в PreferencesService.update', async () => {
      const result = { interestsDescription: 'наука' };
      preferencesService.update.mockResolvedValue(result);

      const response = await controller.update({ interestsDescription: 'наука' }, user);

      expect(response).toEqual(result);
      expect(preferencesService.update).toHaveBeenCalledWith('u1', {
        interestsDescription: 'наука',
      });
    });

    it('передаёт null для сброса поля', async () => {
      const result = { interestsDescription: null };
      preferencesService.update.mockResolvedValue(result);

      const response = await controller.update({ interestsDescription: null }, user);

      expect(response).toEqual(result);
      expect(preferencesService.update).toHaveBeenCalledWith('u1', {
        interestsDescription: null,
      });
    });

    it('не передаёт ключ interestsDescription, если он отсутствует в теле запроса (партиальный PATCH)', async () => {
      const result = { interestsDescription: 'прежнее значение' };
      preferencesService.update.mockResolvedValue(result);

      const response = await controller.update({}, user);

      expect(response).toEqual(result);
      expect(preferencesService.update).toHaveBeenCalledWith('u1', {});
    });
  });

  describe('getForSource', () => {
    it('делегирует userId и sourceId в PreferencesService.getForSource', async () => {
      const result = { interestsDescription: 'космос' };
      preferencesService.getForSource.mockResolvedValue(result);

      const response = await controller.getForSource('s1', user);

      expect(response).toEqual(result);
      expect(preferencesService.getForSource).toHaveBeenCalledWith('u1', 's1');
    });
  });

  describe('updateForSource', () => {
    it('делегирует userId, sourceId и interestsDescription в PreferencesService.updateForSource', async () => {
      const result = { interestsDescription: 'наука' };
      preferencesService.updateForSource.mockResolvedValue(result);

      const response = await controller.updateForSource(
        's1',
        { interestsDescription: 'наука' },
        user,
      );

      expect(response).toEqual(result);
      expect(preferencesService.updateForSource).toHaveBeenCalledWith('u1', 's1', {
        interestsDescription: 'наука',
      });
    });

    it('передаёт null для сброса поля', async () => {
      const result = { interestsDescription: null };
      preferencesService.updateForSource.mockResolvedValue(result);

      const response = await controller.updateForSource('s1', { interestsDescription: null }, user);

      expect(response).toEqual(result);
      expect(preferencesService.updateForSource).toHaveBeenCalledWith('u1', 's1', {
        interestsDescription: null,
      });
    });

    it('не передаёт ключ interestsDescription, если он отсутствует в теле запроса (партиальный PATCH)', async () => {
      const result = { interestsDescription: 'прежнее значение' };
      preferencesService.updateForSource.mockResolvedValue(result);

      const response = await controller.updateForSource('s1', {}, user);

      expect(response).toEqual(result);
      expect(preferencesService.updateForSource).toHaveBeenCalledWith('u1', 's1', {});
    });
  });
});
