import { Logger } from '@nestjs/common';

// env читается лениво и кэшируется в getEnv; задаём переменные до импорта сервиса.
process.env['DATABASE_URL'] = 'postgresql://u:p@localhost:5432/db';
process.env['JWT_SECRET'] = 'x'.repeat(32);
process.env['JWT_REFRESH_SECRET'] = 'y'.repeat(32);
process.env['MAIL_TRANSPORT'] = 'json';
process.env['MAIL_FROM'] = 'no-reply@test.dev';
process.env['WEB_URL'] = 'https://app.test';

import { MailerService } from './mailer.service';

describe('MailerService (json transport)', () => {
  let service: MailerService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new MailerService();
    service.onModuleInit();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('логирует письмо в json-режиме', async () => {
    await service.sendVerificationEmail('user@test.dev', 'tok123');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('строит ссылку верификации из WEB_URL и кодирует токен', async () => {
    await service.sendVerificationEmail('user@test.dev', 'a b/c');
    const message = (logSpy.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain('https://app.test/verify-email?token=a%20b%2Fc');
    expect(message).toContain('no-reply@test.dev');
    expect(message).toContain('user@test.dev');
  });

  it('строит ссылку сброса пароля из WEB_URL', async () => {
    await service.sendPasswordResetEmail('user@test.dev', 'reset-tok');
    const message = (logSpy.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain('https://app.test/reset-password?token=reset-tok');
  });

  it('пробрасывает ошибку транспорта', async () => {
    jest
      .spyOn(
        (service as unknown as { transporter: { sendMail: jest.Mock } }).transporter,
        'sendMail',
      )
      .mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.sendVerificationEmail('user@test.dev', 'tok')).rejects.toThrow(
      'smtp down',
    );
  });
});
