import type { NotificationChannel } from '@prisma/client';
import { mailer } from '../lib/mailer.js';

export type NotificationDelivery = { recipient: string; title: string; body: string };
export interface NotificationProvider { readonly channel: NotificationChannel; send(input: NotificationDelivery): Promise<void>; }

class SmtpNotificationProvider implements NotificationProvider {
  readonly channel = 'EMAIL' as const;
  send(input: NotificationDelivery): Promise<void> { return mailer.send(input.recipient, input.title, input.body); }
}

class UnavailableNotificationProvider implements NotificationProvider {
  constructor(readonly channel: NotificationChannel) {}
  async send(_input: NotificationDelivery): Promise<void> {
    throw new Error(`${this.channel} delivery provider is not configured; delivery was not attempted`);
  }
}

export const notificationProviders: Record<NotificationChannel, NotificationProvider> = {
  EMAIL: new SmtpNotificationProvider(),
  SMS: new UnavailableNotificationProvider('SMS'),
  WHATSAPP: new UnavailableNotificationProvider('WHATSAPP'),
  PUSH: new UnavailableNotificationProvider('PUSH'),
};
