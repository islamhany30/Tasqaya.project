import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {

  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept':       'application/json',
          'api-key':      process.env.BREVO_API_KEY as string,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name:  'Tasqaya App',
            email: process.env.EMAIL_SENDER as string,
          },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html ?? `<html><body><p>${options.text}</p></body></html>`,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Brevo error:', err);
      } else {
        const res = await response.json();
        console.log('Email sent:', res.messageId);
      }

    } catch (err: any) {
      console.error('Mail error:', err.message);
    }
  }
}