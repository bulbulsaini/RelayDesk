import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

interface EmailParams {
  to: string;
  subject: string;
  text: string;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtp.host || !env.smtp.user) {
    return null;
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });
  }
  return cachedTransporter;
}

export async function sendNotificationEmail({ to, subject, text }: EmailParams): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    if (env.nodeEnv === 'development') {
      console.info(`[MailPreview] To: ${to} | Subject: ${subject} | Body: ${text}`);
    }
    return;
  }

  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
  });
}
