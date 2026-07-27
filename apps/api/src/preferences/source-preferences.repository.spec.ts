import type { PrismaService } from '../prisma/prisma.service';

import { SourcePreferencesRepository } from './source-preferences.repository';

describe('SourcePreferencesRepository', () => {
  let prisma: {
    sourcePreference: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let repository: SourcePreferencesRepository;

  beforeEach(() => {
    prisma = {
      sourcePreference: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    repository = new SourcePreferencesRepository(prisma as unknown as PrismaService);
  });

  it('findByUserAndSource возвращает запись, если она найдена', async () => {
    const preference = { userId: 'u1', sourceId: 's1', interestsDescription: 'спорт' };
    prisma.sourcePreference.findUnique.mockResolvedValue(preference);

    const result = await repository.findByUserAndSource('u1', 's1');

    expect(result).toEqual(preference);
    expect(prisma.sourcePreference.findUnique).toHaveBeenCalledWith({
      where: { userId_sourceId: { userId: 'u1', sourceId: 's1' } },
    });
  });

  it('findByUserAndSource возвращает null, если записи нет', async () => {
    prisma.sourcePreference.findUnique.mockResolvedValue(null);

    const result = await repository.findByUserAndSource('u1', 's1');

    expect(result).toBeNull();
  });

  it('upsert создаёт новую запись, если её не было', async () => {
    const created = { userId: 'u1', sourceId: 's1', interestsDescription: 'спорт' };
    prisma.sourcePreference.upsert.mockResolvedValue(created);

    const result = await repository.upsert('u1', 's1', { interestsDescription: 'спорт' });

    expect(result).toEqual(created);
    expect(prisma.sourcePreference.upsert).toHaveBeenCalledWith({
      where: { userId_sourceId: { userId: 'u1', sourceId: 's1' } },
      create: { userId: 'u1', sourceId: 's1', interestsDescription: 'спорт' },
      update: { interestsDescription: 'спорт' },
    });
  });

  it('upsert обновляет существующую запись, в т.ч. сбрасывая поле в null', async () => {
    const updated = { userId: 'u1', sourceId: 's1', interestsDescription: null };
    prisma.sourcePreference.upsert.mockResolvedValue(updated);

    const result = await repository.upsert('u1', 's1', { interestsDescription: null });

    expect(result).toEqual(updated);
    expect(prisma.sourcePreference.upsert).toHaveBeenCalledWith({
      where: { userId_sourceId: { userId: 'u1', sourceId: 's1' } },
      create: { userId: 'u1', sourceId: 's1', interestsDescription: null },
      update: { interestsDescription: null },
    });
  });

  it('upsert передаёт пустую строку как есть (не превращает в null)', async () => {
    const updated = { userId: 'u1', sourceId: 's1', interestsDescription: '' };
    prisma.sourcePreference.upsert.mockResolvedValue(updated);

    const result = await repository.upsert('u1', 's1', { interestsDescription: '' });

    expect(result).toEqual(updated);
    expect(prisma.sourcePreference.upsert).toHaveBeenCalledWith({
      where: { userId_sourceId: { userId: 'u1', sourceId: 's1' } },
      create: { userId: 'u1', sourceId: 's1', interestsDescription: '' },
      update: { interestsDescription: '' },
    });
  });

  it('upsert не трогает поле при update, если ключ interestsDescription отсутствует (партиальный PATCH)', async () => {
    const unchanged = { userId: 'u1', sourceId: 's1', interestsDescription: 'прежнее значение' };
    prisma.sourcePreference.upsert.mockResolvedValue(unchanged);

    const result = await repository.upsert('u1', 's1', {});

    expect(result).toEqual(unchanged);
    expect(prisma.sourcePreference.upsert).toHaveBeenCalledWith({
      where: { userId_sourceId: { userId: 'u1', sourceId: 's1' } },
      create: { userId: 'u1', sourceId: 's1', interestsDescription: null },
      update: {},
    });
  });
});
