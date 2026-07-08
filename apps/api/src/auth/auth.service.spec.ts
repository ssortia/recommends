// env читается лениво в getEnv; задаём переменные до импорта сервиса.
process.env['DATABASE_URL'] = 'postgresql://u:p@localhost:5432/db';
process.env['JWT_SECRET'] = 'x'.repeat(32);
process.env['JWT_REFRESH_SECRET'] = 'y'.repeat(32);
process.env['EMAIL_VERIFICATION_TTL'] = '24h';
process.env['PASSWORD_RESET_TTL'] = '1h';

import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import type { MailerService } from '../mailer/mailer.service';
import type { UsersService } from '../users/users.service';
import type { VerificationService } from '../verification/verification.service';

import { AuthService } from './auth.service';
import type { TestTokenStore } from './test-token.store';

describe('AuthService', () => {
  let usersService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
    updateRefreshToken: jest.Mock;
    markEmailVerified: jest.Mock;
    updatePassword: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };
  let verificationService: { issue: jest.Mock; consume: jest.Mock };
  let mailerService: { sendVerificationEmail: jest.Mock; sendPasswordResetEmail: jest.Mock };
  let testTokenStore: { record: jest.Mock; getLast: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateRefreshToken: jest.fn().mockResolvedValue(undefined),
      markEmailVerified: jest.fn().mockResolvedValue(undefined),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('token') };
    verificationService = {
      issue: jest.fn().mockResolvedValue('plain-token'),
      consume: jest.fn(),
    };
    mailerService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    testTokenStore = { record: jest.fn(), getLast: jest.fn() };

    service = new AuthService(
      usersService as unknown as UsersService,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jwtService as any,
      verificationService as unknown as VerificationService,
      mailerService as unknown as MailerService,
      testTokenStore as unknown as TestTokenStore,
    );
  });

  describe('register', () => {
    it('выпускает токен верификации и отправляет письмо, при этом логинит', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', role: 'USER' });

      const tokens = await service.register('a@b.com', 'password123');

      expect(verificationService.issue).toHaveBeenCalledWith('u1', 'EMAIL_VERIFICATION');
      expect(mailerService.sendVerificationEmail).toHaveBeenCalledWith('a@b.com', 'plain-token');
      // Логин по-прежнему происходит — возвращаются токены.
      expect(tokens).toEqual({ accessToken: 'token', refreshToken: 'token' });
    });

    it('бросает ConflictException и не шлёт письмо, если email занят', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'u1' });

      await expect(service.register('a@b.com', 'password123')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mailerService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('гасит токен и помечает email подтверждённым', async () => {
      verificationService.consume.mockResolvedValue('u1');

      await service.verifyEmail('plain-token');

      expect(verificationService.consume).toHaveBeenCalledWith('plain-token', 'EMAIL_VERIFICATION');
      expect(usersService.markEmailVerified).toHaveBeenCalledWith('u1');
    });

    it('пробрасывает ошибку при невалидном токене и не трогает пользователя', async () => {
      verificationService.consume.mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyEmail('bad')).rejects.toThrow('Invalid token');
      expect(usersService.markEmailVerified).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('отправляет письмо, если пользователь существует и не подтверждён', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        emailVerified: false,
      });

      await service.resendVerification('a@b.com');

      expect(mailerService.sendVerificationEmail).toHaveBeenCalledWith('a@b.com', 'plain-token');
    });

    it('не раскрывает существование: для несуществующего email — тихий no-op', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.resendVerification('missing@b.com')).resolves.toBeUndefined();
      expect(mailerService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('не шлёт письмо повторно уже подтверждённому пользователю', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        emailVerified: true,
      });

      await service.resendVerification('a@b.com');

      expect(mailerService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('выпускает PASSWORD_RESET-токен и шлёт письмо для существующего email', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await service.forgotPassword('a@b.com');

      expect(verificationService.issue).toHaveBeenCalledWith('u1', 'PASSWORD_RESET');
      expect(mailerService.sendPasswordResetEmail).toHaveBeenCalledWith('a@b.com', 'plain-token');
    });

    it('даёт одинаковый ответ (тихий no-op) для несуществующего email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.forgotPassword('missing@b.com')).resolves.toBeUndefined();
      expect(verificationService.issue).not.toHaveBeenCalled();
      expect(mailerService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('гасит токен, хэширует пароль и сбрасывает сессии', async () => {
      verificationService.consume.mockResolvedValue('u1');

      await service.resetPassword('plain-token', 'new-password123');

      expect(verificationService.consume).toHaveBeenCalledWith('plain-token', 'PASSWORD_RESET');
      expect(usersService.updatePassword).toHaveBeenCalledTimes(1);
      const [userId, hash] = usersService.updatePassword.mock.calls[0];
      expect(userId).toBe('u1');
      // Пароль приходит уже захэшированным (не в открытом виде).
      expect(hash).not.toBe('new-password123');
      expect(await bcrypt.compare('new-password123', hash)).toBe(true);
    });

    it('пробрасывает ошибку при невалидном токене и не меняет пароль', async () => {
      verificationService.consume.mockRejectedValue(new Error('Invalid token'));

      await expect(service.resetPassword('bad', 'new-password123')).rejects.toThrow(
        'Invalid token',
      );
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('пробрасывает ошибку при истёкшем токене и не меняет пароль', async () => {
      verificationService.consume.mockRejectedValue(new Error('Token expired'));

      await expect(service.resetPassword('expired', 'new-password123')).rejects.toThrow(
        'Token expired',
      );
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });
  });
});
