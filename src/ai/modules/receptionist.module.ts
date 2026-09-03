/**
 * @module ai/modules/receptionist.module
 * @description AI Receptionist Module — 24/7 Virtual Receptionist for booking, FAQs, availability, and routing.
 */

import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';
import { conversationManager } from '../memory/conversation-manager.js';
import { sanitizeUserInput } from '../utils/sanitize.js';
import type { ChatMessage } from '../types/ai.types.js';

export interface ReceptionistRequest {
  tenantId: string;
  userId: string;
  sessionId?: string;
  patientQuery: string;
  doctorSchedules?: string;
  hospitalFaqs?: string;
  patientLanguage?: string;
  hospitalName?: string;
}

export interface ReceptionistResponse {
  responseMessage: string;
  action: 'book_appointment' | 'reschedule_appointment' | 'cancel_appointment' | 'answer_faq' | 'guide_department' | 'escalate_staff';
  extractedDetails: Record<string, unknown>;
  shouldEscalate: boolean;
  confidenceScore: number;
  latencyMs: number;
}

export class AIReceptionistModule {
  async processQuery(input: ReceptionistRequest): Promise<ReceptionistResponse> {
    const startMs = Date.now();
    const sanitized = sanitizeUserInput(input.patientQuery);

    const session = await conversationManager.getOrCreate(input.tenantId, input.userId, undefined, input.sessionId);

    const messages = promptManager.render('ai-receptionist', {
      HOSPITAL_NAME: input.hospitalName ?? 'Rizocare Hospital',
      PATIENT_QUERY: sanitized,
      DOCTOR_SCHEDULES: input.doctorSchedules ?? 'Standard business hours 9am - 5pm',
      HOSPITAL_FAQS: input.hospitalFaqs ?? 'General hospital guidance',
      PATIENT_LANG: input.patientLanguage ?? 'English',
    });

    const userMsg: ChatMessage = { role: 'user', content: sanitized };
    const updatedSession = await conversationManager.append(session, userMsg);
    const fullMessages = conversationManager.getMessages(updatedSession, messages[0]);

    const result = await chatService.complete(fullMessages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<ReceptionistResponse> = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        responseMessage: result.content,
        action: 'answer_faq',
        extractedDetails: {},
        shouldEscalate: false,
        confidenceScore: 0.8,
      };
    }

    await conversationManager.append(updatedSession, { role: 'assistant', content: parsed.responseMessage ?? result.content });

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'ai-receptionist',
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      success: true,
    });

    return {
      responseMessage: parsed.responseMessage ?? result.content,
      action: parsed.action ?? 'answer_faq',
      extractedDetails: parsed.extractedDetails ?? {},
      shouldEscalate: Boolean(parsed.shouldEscalate),
      confidenceScore: parsed.confidenceScore ?? 0.9,
      latencyMs,
    };
  }
}

export const aiReceptionistModule = new AIReceptionistModule();
