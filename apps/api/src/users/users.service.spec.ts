import type { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let repository: {
    markEmailVerified: jest.Mock;
    updatePassword: jest.Mock;
  };
  let service: UsersService;

  beforeEach(() => {
    repository = {
      markEmailVerified: jest.fn().mockResolvedValue(undefined),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(repository as unknown as UsersRepository);
  });

  it('markEmailVerified делегирует в репозиторий', async () => {
    await service.markEmailVerified('u1');
    expect(repository.markEmailVerified).toHaveBeenCalledWith('u1');
  });

  it('updatePassword делегирует уже захэшированный пароль в репозиторий', async () => {
    await service.updatePassword('u1', 'new-hash');
    expect(repository.updatePassword).toHaveBeenCalledWith('u1', 'new-hash');
  });
});
