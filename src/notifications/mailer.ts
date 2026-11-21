import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Optional e-mail copy of notifications through any SMTP server (SMTP_HOST,
 * SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). Without SMTP_HOST it is
 * disabled and the in-app inbox is the only channel. Failures never break
 * the app; only counts are logged, never addresses or content (RODO).
 */
@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST')?.trim();
    const port = Number(config.get<string>('SMTP_PORT') ?? 587);
    const user = config.get<string>('SMTP_USER')?.trim();
    const pass = config.get<string>('SMTP_PASS') ?? '';
    this.from =
      config.get<string>('SMTP_FROM')?.trim() || 'asystent-ocen@localhost';
    this.transport = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          ...(user ? { auth: { user, pass } } : {}),
        })
      : null;
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  async send(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.transport) return false;
    try {
      await this.transport.sendMail({ from: this.from, to, subject, text });
      return true;
    } catch {
      this.logger.warn('Nie udało się wysłać powiadomienia e-mail.');
      return false;
    }
  }
}
