/**
 * @module ai/modules/doctor-assistant.module
 * @description AI Doctor Assistant Module — Consultation notes, history summaries, prescriptions, discharge summaries, and referral drafts.
 */

import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';
import { sanitizeUserInput, wrapAsDraft } from '../utils/sanitize.js';

export type DoctorTaskType =
  | 'summarize_history'
  | 'consultation_notes'
  | 'draft_prescription'
  | 'follow_up_plan'
  | 'discharge_summary'
  | 'referral_letter'
  | 'patient_instructions'
  | 'voice_to_notes';

export interface DoctorAssistantInput {
  tenantId: string;
  userId: string;
  doctorName?: string;
  taskType: DoctorTaskType;
  patientHistory?: string;
  consultationInput: string;
}

export interface DoctorAssistantResult {
  aiDraftNote: string;
  taskType: DoctorTaskType;
  generatedContent: string;
  structuredData: Record<string, unknown>;
  requiresApproval: boolean;
  latencyMs: number;
}

export class AIDoctorAssistantModule {
  async executeTask(input: DoctorAssistantInput): Promise<DoctorAssistantResult> {
    const startMs = Date.now();

    const messages = promptManager.render('ai-doctor-assistant', {
      DOCTOR_NAME: input.doctorName ?? 'Attending Clinician',
      TASK_TYPE: input.taskType,
      PATIENT_HISTORY: sanitizeUserInput(input.patientHistory ?? 'None recorded'),
      CONSULTATION_INPUT: sanitizeUserInput(input.consultationInput),
    });

    const result = await chatService.complete(messages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<DoctorAssistantResult> = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        generatedContent: result.content,
        structuredData: {},
      };
    }

    const draftText = wrapAsDraft(
      parsed.generatedContent ?? result.content,
      `Doctor Assistant: ${input.taskType}`
    );

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: `doctor-assistant:${input.taskType}`,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      success: true,
    });

    return {
      aiDraftNote: 'DRAFT: Clinical judgment required. Requires physician approval prior to inclusion in medical record.',
      taskType: input.taskType,
      generatedContent: draftText,
      structuredData: parsed.structuredData ?? {},
      requiresApproval: true, // Always true per strict rule
      latencyMs,
    };
  }
}

export const aiDoctorAssistantModule = new AIDoctorAssistantModule();
