import { Injectable } from '@nestjs/common';
import type { VerificationToken, VerificationTokenType } from '@prisma/client';
import { Prisma } from '@prisma/client';

import type { BaseModelDelegate } from '../common/repository/base.repository';
import { BaseRepository } from '../common/repository/base.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VerificationRepository extends BaseRepository<
  VerificationToken,
  Prisma.VerificationTokenCreateInput,
  Prisma.VerificationTokenUpdateInput
> {
  constructor(private readonly prisma: PrismaService) {
    // Каст необходим: Prisma-делегаты используют сложные условные дженерики,
    // которые TypeScript не унифицирует с простым структурным интерфейсом.
    super(
      prisma.verificationToken as unknown as BaseModelDelegate<
        VerificationToken,
        Prisma.VerificationTokenCreateInput,
        Prisma.VerificationTokenUpdateInput
      >,
    );
  }

  // Базовый create — protected; расширяем видимость до public для VerificationService.
  override create(data: Prisma.VerificationTokenCreateInput): Promise<VerificationToken> {
    return super.create(data);
  }

  findByTokenHash(tokenHash: string): Promise<VerificationToken | null> {
    return this.prisma.verificationToken.findUnique({ where: { tokenHash } });
  }

  // Атомарное «погашение» токена: удаляем по хэшу+типу и возвращаем число удалённых.
  // count === 1 означает, что именно этот вызов забрал одноразовый токен (защита от гонки).
  async deleteByTokenHashAndType(tokenHash: string, type: VerificationTokenType): Promise<number> {
    const { count } = await this.prisma.verificationToken.deleteMany({
      where: { tokenHash, type },
    });
    return count;
  }

  // Инвалидация всех ранее выпущенных токенов того же типа для пользователя.
  async deleteByUserAndType(userId: string, type: VerificationTokenType): Promise<void> {
    await this.prisma.verificationToken.deleteMany({ where: { userId, type } });
  }
}
