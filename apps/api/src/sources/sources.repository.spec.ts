import type { PrismaService } from '../prisma/prisma.service';

import { SourcesRepository } from './sources.repository';

describe('SourcesRepository', () => {
  let prisma: {
    source: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let repository: SourcesRepository;

  beforeEach(() => {
    prisma = {
      source: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    repository = new SourcesRepository(prisma as unknown as PrismaService);
  });

  it('findByUrl возвращает источник, если он найден', async () => {
    const source = { id: 's1', url: 'https://example.com/feed.xml' };
    prisma.source.findUnique.mockResolvedValue(source);

    const result = await repository.findByUrl('https://example.com/feed.xml');

    expect(result).toEqual(source);
    expect(prisma.source.findUnique).toHaveBeenCalledWith({
      where: { url: 'https://example.com/feed.xml' },
    });
  });

  it('findByUrl возвращает null, если источник не найден', async () => {
    prisma.source.findUnique.mockResolvedValue(null);

    const result = await repository.findByUrl('https://unknown.example.com/feed.xml');

    expect(result).toBeNull();
  });

  it('createWithinTransaction создаёт источник через переданный tx-клиент', async () => {
    const tx = { source: { create: jest.fn().mockResolvedValue({ id: 's1' }) } };
    const data = {
      type: 'RSS' as const,
      url: 'https://example.com/feed.xml',
      title: 'Example',
      lastFetchedAt: new Date(),
    };

    const result = await repository.createWithinTransaction(
      tx as unknown as Parameters<SourcesRepository['createWithinTransaction']>[0],
      data,
    );

    expect(result).toEqual({ id: 's1' });
    expect(tx.source.create).toHaveBeenCalledWith({ data });
    // Убеждаемся, что использован переданный tx-клиент, а не this.prisma
    expect(prisma.source.create).not.toHaveBeenCalled();
  });
});
