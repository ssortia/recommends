import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { User } from '@prisma/client';

/**
 * Пропускает только пользователей с подтверждённым email.
 * Применяется к маршрутам, требующим верификации почты, поверх JwtAuthGuard.
 */
@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: User }>();

    // Fail-closed: гард рассчитан на работу поверх JwtAuthGuard (user всегда есть),
    // но при отсутствии user считаем email неподтверждённым, а не пропускаем.
    if (request.user?.emailVerified !== true) {
      throw new ForbiddenException('EmailNotVerified');
    }

    return true;
  }
}
