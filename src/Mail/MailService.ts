import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }) {
    try {
      await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: options.to,
        subject: options.subject,
        text: options.text ?? '',
        html: options.html ?? '',
      });
    } catch (error) {
      console.error('Mail Error:', error);
    }
  }
}