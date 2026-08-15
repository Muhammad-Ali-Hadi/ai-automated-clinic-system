import nodemailer from 'nodemailer';
import { AppError } from '../utils/app-error.js';
import { env, isMailerConfigured } from '../config/env.js';
import { logger } from './logger.js';

const transporter = isMailerConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

export const mailer = {
  isConfigured: () => transporter !== null,
  async send(to: string, subject: string, text: string): Promise<void> {
    if (!transporter) throw new AppError('Email delivery is not configured.', 503);
    try {
      await transporter.sendMail({ from: env.SMTP_FROM, to, subject, text });
      logger.info({ recipientDomain: to.split('@')[1] }, 'Email dispatched');
    } catch (error) {
      logger.error({ err: error, recipientDomain: to.split('@')[1] }, 'Email dispatch failed');
      throw new AppError('Email delivery is temporarily unavailable.', 503);
    }
  },
};
