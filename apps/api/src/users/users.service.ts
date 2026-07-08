import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Role, User } from '@prisma/client';

import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { PublicUser } from './users.repository';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  me(userId: string): Promise<PublicUser | null> {
    return this.usersRepository.findOnePublic(userId);
  }

  findAll(query?: ListUsersQueryDto): Promise<PublicUser[]> {
    return this.usersRepository.findAllPublic(query);
  }

  create(email: string, hashedPassword: string): Promise<User> {
    return this.usersRepository.create({ email, password: hashedPassword });
  }

  async updateRole(callerId: string, targetId: string, role: Role): Promise<PublicUser> {
    if (callerId === targetId) throw new ForbiddenException('Cannot change your own role');
    return this.usersRepository.updateRole(targetId, role);
  }

  updateRefreshToken(userId: string, hashedToken: string | null): Promise<void> {
    return this.usersRepository.updateRefreshToken(userId, hashedToken);
  }

  markEmailVerified(userId: string): Promise<void> {
    return this.usersRepository.markEmailVerified(userId);
  }

  // Пароль приходит уже захэшированным (хэширование остаётся в auth-слое).
  updatePassword(userId: string, hashedPassword: string): Promise<void> {
    return this.usersRepository.updatePassword(userId, hashedPassword);
  }
}
