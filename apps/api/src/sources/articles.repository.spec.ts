import { Prisma } from '@prisma/client';

import type { RssItem } from './rss.gate';

import { ArticlesRepository } from './articles.repository';

function duplicateError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.2',
  });
}

describe('ArticlesRepository', () => {
  let tx: { article: { create: jest.Mock } };
  let repository: ArticlesRepository;

  beforeEach(() => {
    tx = { article: { create: jest.fn() } };
    repository = new ArticlesRepository();
  });

  it('создаёт новые статьи и возвращает их количество', async () => {
    tx.article.create.mockResolvedValue({});
    const items: RssItem[] = [
      {
        guid: 'g1',
        link: 'https://example.com/1',
        title: 'Post 1',
        isoDate: '2026-01-01T00:00:00Z',
      },
      {
        guid: 'g2',
        link: 'https://example.com/2',
        title: 'Post 2',
        isoDate: '2026-01-02T00:00:00Z',
      },
    ];

    const count = await repository.upsertMany(
      tx as unknown as Prisma.TransactionClient,
      's1',
      items,
    );

    expect(count).toBe(2);
    expect(tx.article.create).toHaveBeenCalledTimes(2);
  });

  it('не увеличивает счётчик и не падает при повторном externalId (P2002)', async () => {
    tx.article.create.mockRejectedValue(duplicateError());
    const items: RssItem[] = [{ guid: 'g1', link: 'https://example.com/1', title: 'Post 1' }];

    const count = await repository.upsertMany(
      tx as unknown as Prisma.TransactionClient,
      's1',
      items,
    );

    expect(count).toBe(0);
  });

  it('пропускает элемент без guid и без link', async () => {
    const items: RssItem[] = [{ title: 'Без ссылки' }];

    const count = await repository.upsertMany(
      tx as unknown as Prisma.TransactionClient,
      's1',
      items,
    );

    expect(count).toBe(0);
    expect(tx.article.create).not.toHaveBeenCalled();
  });

  it('сохраняет элемент без даты с publishedAt: null', async () => {
    tx.article.create.mockResolvedValue({});
    const items: RssItem[] = [{ guid: 'g1', link: 'https://example.com/1', title: 'Post 1' }];

    await repository.upsertMany(tx as unknown as Prisma.TransactionClient, 's1', items);

    expect(tx.article.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ publishedAt: null }),
    });
  });

  it('пробрасывает ошибку, не связанную с уникальностью', async () => {
    tx.article.create.mockRejectedValue(new Error('boom'));
    const items: RssItem[] = [{ guid: 'g1', link: 'https://example.com/1', title: 'Post 1' }];

    await expect(
      repository.upsertMany(tx as unknown as Prisma.TransactionClient, 's1', items),
    ).rejects.toThrow('boom');
  });
});
