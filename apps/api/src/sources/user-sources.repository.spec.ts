import type { PrismaService } from '../prisma/prisma.service';

import { UserSourcesRepository } from './user-sources.repository';

describe('UserSourcesRepository', () => {
  let prisma: {
    userSource: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };
  let repository: UserSourcesRepository;

  beforeEach(() => {
    prisma = {
      userSource: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    repository = new UserSourcesRepository(prisma as unknown as PrismaService);
  });

  it('exists возвращает true, если подписка найдена', async () => {
    prisma.userSource.findUnique.mockResolvedValue({ userId: 'u1', sourceId: 's1' });

    const result = await repository.exists('u1', 's1');

    expect(result).toBe(true);
    expect(prisma.userSource.findUnique).toHaveBeenCalledWith({
      where: { userId_sourceId: { userId: 'u1', sourceId: 's1' } },
    });
  });

  it('exists возвращает false, если подписки нет', async () => {
    prisma.userSource.findUnique.mockResolvedValue(null);

    const result = await repository.exists('u1', 's1');

    expect(result).toBe(false);
  });

  it('create без tx использует this.prisma', async () => {
    prisma.userSource.create.mockResolvedValue({ userId: 'u1', sourceId: 's1' });

    await repository.create('u1', 's1');

    expect(prisma.userSource.create).toHaveBeenCalledWith({
      data: { userId: 'u1', sourceId: 's1' },
    });
  });

  it('create с tx использует переданный транзакционный клиент', async () => {
    const tx = {
      userSource: { create: jest.fn().mockResolvedValue({ userId: 'u1', sourceId: 's1' }) },
    };

    await repository.create(
      'u1',
      's1',
      tx as unknown as Parameters<UserSourcesRepository['create']>[2],
    );

    expect(tx.userSource.create).toHaveBeenCalledWith({ data: { userId: 'u1', sourceId: 's1' } });
    expect(prisma.userSource.create).not.toHaveBeenCalled();
  });

  it('findAllByUser возвращает подписки пользователя с источником', async () => {
    const rows = [{ userId: 'u1', sourceId: 's1', source: { id: 's1' } }];
    prisma.userSource.findMany.mockResolvedValue(rows);

    const result = await repository.findAllByUser('u1');

    expect(result).toEqual(rows);
    expect(prisma.userSource.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('delete вызывает prisma.userSource.delete с правильным where', async () => {
    prisma.userSource.delete.mockResolvedValue({ userId: 'u1', sourceId: 's1' });

    await repository.delete('u1', 's1');

    expect(prisma.userSource.delete).toHaveBeenCalledWith({
      where: { userId_sourceId: { userId: 'u1', sourceId: 's1' } },
    });
  });

  it('delete пробрасывает ошибку P2025, если записи нет', async () => {
    const notFoundError = Object.assign(new Error('Record not found'), { code: 'P2025' });
    prisma.userSource.delete.mockRejectedValue(notFoundError);

    await expect(repository.delete('u1', 's1')).rejects.toBe(notFoundError);
  });
});
