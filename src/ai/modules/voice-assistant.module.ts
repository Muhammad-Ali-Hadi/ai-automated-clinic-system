/**
 * @module ai/modules/voice-assistant.module
 * @description AI Voice Assistant Module — Speech-to-text, voice command intent parsing, and consultation transcription.
 */

import { speechService } from '../services/speech.service.js';
import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { tokenUsageTracker } from '../analytics/token-usage-tracker.js';

export interface VoiceProcessInput {
  tenantId: string;
  userId: string;
  audioBuffer: Buffer;
  filename: string;
  contextModule?: string;
  language?: string;
}

export interface VoiceProcessResult {
  transcription: string;
  intent: string;
  confidence: number;
  action: string;
  parameters: Record<string, unknown>;
  structuredSummary: string;
  latencyMs: number;
}

export class AIVoiceAssistantModule {
  async processAudioCommand(input: VoiceProcessInput): Promise<VoiceProcessResult> {
    const startMs = Date.now();

    // Step 1: Speech to Text via Whisper
    const sttResult = await speechService.transcribe(input.audioBuffer, input.filename, {
      language: input.language,
    });

    // Step 2: Intent & Action Parsing via LLM
    const messages = promptManager.render('ai-voice-assistant', {
      CONTEXT_MODULE: input.contextModule ?? 'general_navigation',
      TRANSCRIPTION_TEXT: sttResult.text,
    });

    const llmResult = await chatService.complete(messages, { jsonMode: true });
    const latencyMs = Date.now() - startMs;

    let parsed: Partial<VoiceProcessResult> = {};
    try {
      parsed = JSON.parse(llmResult.content);
    } catch {
      parsed = {
        intent: 'general_command',
        confidence: 0.85,
        action: 'display_text',
        parameters: {},
        structuredSummary: sttResult.text,
      };
    }

    tokenUsageTracker.record({
      tenantId: input.tenantId,
      userId: input.userId,
      feature: 'voice-assistant',
      model: llmResult.model,
      provider: llmResult.provider,
      usage: llmResult.usage,
      latencyMs,
      success: true,
    });

    return {
      transcription: sttResult.text,
      intent: parsed.intent ?? 'unknown',
      confidence: parsed.confidence ?? 0.9,
      action: parsed.action ?? 'none',
      parameters: parsed.parameters ?? {},
      structuredSummary: parsed.structuredSummary ?? sttResult.text,
      latencyMs,
    };
  }

  /** Direct streaming transcript generator wrapper for UI real-time feeds */
  async transcribeOnly(audioBuffer: Buffer, filename: string, language?: string) {
    return speechService.transcribe(audioBuffer, filename, { language });
  }
}

export const aiVoiceAssistantModule = new AIVoiceAssistantModule();
