import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { getEnv } from '../config/env';

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter!: Transporter;
  // Env читаем один раз и обращаемся к нему единообразно во всём классе.
  private readonly env = getEnv();
  private readonly from = this.env.MAIL_FROM;
  private readonly webUrl = this.env.WEB_URL;

  // Транспорт инициализируем при старте модуля: в dev — jsonTransport (письма не
  // уходят наружу, а сериализуются и логируются), в prod — реальный SMTP из env.
  onModuleInit(): void {
    const env = this.env;
    if (env.MAIL_TRANSPORT === 'smtp') {
      this.transporter = createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        // 465 — implicit TLS; остальные порты используют STARTTLS.
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
    } else {
      this.transporter = createTransport({ jsonTransport: true });
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `${this.webUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Подтверждение email',
      text: `Для подтверждения почты перейдите по ссылке: ${url}`,
      html: `<p>Для подтверждения почты перейдите по ссылке: <a href="${url}">${url}</a></p>`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const url = `${this.webUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Сброс пароля',
      text: `Для сброса пароля перейдите по ссылке: ${url}`,
      html: `<p>Для сброса пароля перейдите по ссылке: <a href="${url}">${url}</a></p>`,
    });
  }

  private async send(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const info = await this.transporter.sendMail({ from: this.from, ...options });
    // В json-режиме письмо не доставляется — логируем его, чтобы извлекать ссылку в dev/тестах.
    if (this.env.MAIL_TRANSPORT === 'json') {
      this.logger.log({ msg: 'Email sent (jsonTransport)', message: info.message });
    }
  }
}
