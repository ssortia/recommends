import { Injectable } from '@nestjs/common';
import type { Role, User } from '@prisma/client';
import { Prisma } from '@prisma/client';

import type { BaseModelDelegate } from '../common/repository/base.repository';
import { BaseRepository } from '../common/repository/base.repository';
import { PrismaService } from '../prisma/prisma.service';

import type { ListUsersQueryDto } from './dto/list-users-query.dto';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  role: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof PUBLIC_SELECT }>;

@Injectable()
export class UsersRepository extends BaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  constructor(private readonly prisma: PrismaService) {
    // Каст необходим: Prisma-делегаты используют сложные условные дженерики
    // (SelectSubset, GetFindResult, Prisma__ModelClient), которые TypeScript
    // не может унифицировать с простым структурным интерфейсом при присваивании.
    super(
      prisma.user as unknown as BaseModelDelegate<
        User,
        Prisma.UserCreateInput,
        Prisma.UserUpdateInput
      >,
    );
  }

  // Расширяем видимость protected create до public для вызова из UsersService.
  override create(data: Prisma.UserCreateInput): Promise<User> {
    return super.create(data);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findOnePublic(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: PUBLIC_SELECT });
  }

  findAllPublic(query?: ListUsersQueryDto): Promise<PublicUser[]> {
    const where: Prisma.UserWhereInput = {};

    if (query?.email) {
      where.email = { contains: query.email, mode: 'insensitive' };
    }
    if (query?.role) {
      where.role = query.role;
    }

    const sortBy = query?.sortBy ?? 'createdAt';
    const sortOrder = query?.sortOrder ?? 'asc';

    return this.prisma.user.findMany({
      select: PUBLIC_SELECT,
      where,
      orderBy: { [sortBy]: sortOrder },
    });
  }

  updateRole(id: string, role: Role): Promise<PublicUser> {
    return this.prisma.user.update({ where: { id }, data: { role }, select: PUBLIC_SELECT });
  }

  async updateRefreshToken(id: string, hashedToken: string | null): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { refreshToken: hashedToken } });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { emailVerified: true } });
  }

  // Сброс refreshToken вместе с паролем разлогинивает все активные сессии
  // пользователя после смены пароля. Пароль приходит уже захэшированным.
  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword, refreshToken: null },
    });
  }
}
