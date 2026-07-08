import type { PrismaService } from '../prisma/prisma.service';

import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let repository: UsersRepository;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
    };
    repository = new UsersRepository(prisma as unknown as PrismaService);
  });

  it('findOnePublic выбирает emailVerified в публичной выдаче', async () => {
    await repository.findOnePublic('u1');
    const call = prisma.user.findUnique.mock.calls[0][0];
    expect(call.select.emailVerified).toBe(true);
  });

  it('findAllPublic выбирает emailVerified в публичной выдаче', async () => {
    await repository.findAllPublic();
    const call = prisma.user.findMany.mock.calls[0][0];
    expect(call.select.emailVerified).toBe(true);
  });

  it('markEmailVerified выставляет emailVerified=true', async () => {
    await repository.markEmailVerified('u1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailVerified: true },
    });
  });

  it('updatePassword обновляет пароль и сбрасывает refreshToken', async () => {
    await repository.updatePassword('u1', 'new-hash');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: 'new-hash', refreshToken: null },
    });
  });
});
