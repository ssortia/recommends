import type { PrismaService } from '../prisma/prisma.service';

import { PreferencesRepository } from './preferences.repository';

describe('PreferencesRepository', () => {
  let prisma: {
    userPreferences: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let repository: PreferencesRepository;

  beforeEach(() => {
    prisma = {
      userPreferences: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    repository = new PreferencesRepository(prisma as unknown as PrismaService);
  });

  it('findByUserId возвращает запись, если она найдена', async () => {
    const preferences = { id: 'p1', userId: 'u1', interestsDescription: 'спорт' };
    prisma.userPreferences.findUnique.mockResolvedValue(preferences);

    const result = await repository.findByUserId('u1');

    expect(result).toEqual(preferences);
    expect(prisma.userPreferences.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
  });

  it('findByUserId возвращает null, если записи нет', async () => {
    prisma.userPreferences.findUnique.mockResolvedValue(null);

    const result = await repository.findByUserId('u1');

    expect(result).toBeNull();
  });

  it('upsert создаёт новую запись, если её не было', async () => {
    const created = { id: 'p1', userId: 'u1', interestsDescription: 'спорт' };
    prisma.userPreferences.upsert.mockResolvedValue(created);

    const result = await repository.upsert('u1', 'спорт');

    expect(result).toEqual(created);
    expect(prisma.userPreferences.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', interestsDescription: 'спорт' },
      update: { interestsDescription: 'спорт' },
    });
  });

  it('upsert обновляет существующую запись, в т.ч. сбрасывая поле в null', async () => {
    const updated = { id: 'p1', userId: 'u1', interestsDescription: null };
    prisma.userPreferences.upsert.mockResolvedValue(updated);

    const result = await repository.upsert('u1', null);

    expect(result).toEqual(updated);
    expect(prisma.userPreferences.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', interestsDescription: null },
      update: { interestsDescription: null },
    });
  });
});
