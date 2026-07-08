import type { PrismaService } from '../prisma/prisma.service';

import { VerificationRepository } from './verification.repository';

describe('VerificationRepository', () => {
  let prisma: {
    verificationToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let repository: VerificationRepository;

  beforeEach(() => {
    prisma = {
      verificationToken: {
        create: jest.fn().mockResolvedValue({ id: 't1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 't1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    repository = new VerificationRepository(prisma as unknown as PrismaService);
  });

  it('create делегирует в prisma.verificationToken.create', async () => {
    const data = {
      user: { connect: { id: 'u1' } },
      type: 'EMAIL_VERIFICATION' as const,
      tokenHash: 'hash',
      expiresAt: new Date(),
    };
    await repository.create(data);
    expect(prisma.verificationToken.create).toHaveBeenCalledWith({ data });
  });

  it('findByTokenHash ищет по уникальному хэшу', async () => {
    await repository.findByTokenHash('hash');
    expect(prisma.verificationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: 'hash' },
    });
  });

  it('deleteByUserAndType удаляет все токены пользователя данного типа', async () => {
    await repository.deleteByUserAndType('u1', 'PASSWORD_RESET');
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', type: 'PASSWORD_RESET' },
    });
  });

  it('deleteByTokenHashAndType атомарно гасит токен и возвращает count', async () => {
    prisma.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
    const count = await repository.deleteByTokenHashAndType('hash', 'EMAIL_VERIFICATION');
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: 'hash', type: 'EMAIL_VERIFICATION' },
    });
    expect(count).toBe(1);
  });
});
