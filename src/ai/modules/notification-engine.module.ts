/**
 * @module ai/modules/notification-engine.module
 * @description AI Notification Engine Module — Personalized appointment, medication, payment, and schedule alerts.
 */

import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';

export type NotificationType =
  | 'appointment_reminder'
  | 'medication_reminder'
  | 'payment_reminder'
  | 'follow_up_reminder'
  | 'doctor_schedule_alert'
  | 'personalized_patient_alert';

export interface NotificationEngineInput {
  tenantId: string;
  userId: string;
  notificationType: NotificationType;
  recipientType: 'PATIENT' | 'DOCTOR' | 'STAFF';
  contextData: string;
}

export interface NotificationEngineResult {
  title: string;
  body: string;
  channel: 'SMS' | 'EMAIL' | 'PUSH' | 'IN_APP';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  actionUrl: string;
  latencyMs: number;
}

export class AINotificationEngineModule {
  async generateNotification(input: NotificationEngineInput): Promise<NotificationEngineResult> {
    const startMs = Date.now();

    const messages = promptManager.render('ai-notification-engine', {
      NOTIFICATION_TYPE: input.notificationType,
      RECIPIENT_TYPE: input.recipientType,
      CONTEXT_DATA: input.contextData,
    });

    const result = await chatService.complete(messages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<NotificationEngineResult> = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        title: 'Rizocare Notification',
        body: result.content,
        channel: 'IN_APP',
        urgency: 'MEDIUM',
        actionUrl: '',
      };
    }

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: `notification:${input.notificationType}`,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      success: true,
    });

    return {
      title: parsed.title ?? 'Rizocare Update',
      body: parsed.body ?? result.content,
      channel: parsed.channel ?? 'IN_APP',
      urgency: parsed.urgency ?? 'MEDIUM',
      actionUrl: parsed.actionUrl ?? '',
      latencyMs,
    };
  }
}

export const aiNotificationEngineModule = new AINotificationEngineModule();
