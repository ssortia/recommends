import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { msDurationToSeconds } from '../common/duration';
import { getEnv } from '../config/env';
import { MailerService } from '../mailer/mailer.service';
import { UsersService } from '../users/users.service';
import { VerificationService } from '../verification/verification.service';

import { TestTokenStore } from './test-token.store';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private verificationService: VerificationService,
    private mailerService: MailerService,
    private testTokenStore: TestTokenStore,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async register(email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create(email, hashedPassword);
    // Инициируем верификацию почты, но логин разрешаем сразу — доступ к
    // verified-only маршрутам ограничивает VerifiedGuard, а не сам логин.
    await this.sendVerificationEmail(user.id, user.email);
    return this.login(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.verificationService.consume(token, 'EMAIL_VERIFICATION');
    await this.usersService.markEmailVerified(userId);
  }

  /**
   * Повторно отправляет письмо верификации. Не раскрывает, существует ли email
   * и подтверждён ли он: при любом исходе ответ одинаков (тихий no-op).
   */
  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (user && !user.emailVerified) {
      await this.sendVerificationEmail(user.id, user.email);
    }
  }

  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const token = await this.verificationService.issue(userId, 'EMAIL_VERIFICATION');
    this.testTokenStore.record(email, 'EMAIL_VERIFICATION', token);
    try {
      await this.mailerService.sendVerificationEmail(email, token);
    } catch (err) {
      // Ошибка SMTP не должна блокировать регистрацию — пользователь может
      // запросить повторную отправку через /auth/resend-verification.
      this.logger.error({ err, email }, 'Failed to send verification email');
    }
  }

  /**
   * Запрашивает сброс пароля. Не раскрывает, существует ли email: при любом
   * исходе ответ одинаков (тихий no-op для несуществующего пользователя).
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const token = await this.verificationService.issue(user.id, 'PASSWORD_RESET');
      this.testTokenStore.record(user.email, 'PASSWORD_RESET', token);
      try {
        await this.mailerService.sendPasswordResetEmail(user.email, token);
      } catch (err) {
        this.logger.error({ err, email }, 'Failed to send password reset email');
      }
    }
  }

  /**
   * Устанавливает новый пароль по одноразовому токену. Сброс refreshToken
   * разлогинивает все активные сессии пользователя.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const userId = await this.verificationService.consume(token, 'PASSWORD_RESET');
    const hashedPassword = await bcrypt.hash(password, 10);
    await this.usersService.updatePassword(userId, hashedPassword);
  }

  async login(user: User) {
    const tokens = await this.generateTokens(user.id, user.email, user.role, user.emailVerified);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user?.refreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.emailVerified);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  private async generateTokens(userId: string, email: string, role: Role, emailVerified: boolean) {
    const env = getEnv();
    const payload = { sub: userId, email, role, emailVerified };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: env.JWT_SECRET,
        expiresIn: msDurationToSeconds(env.JWT_EXPIRES_IN),
      }),
      this.jwtService.signAsync(payload, {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: msDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(userId, hashedRefreshToken);
  }
}
