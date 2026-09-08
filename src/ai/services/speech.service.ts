/**
 * @module ai/services/speech.service
 * @description OpenAI Whisper speech-to-text transcription service.
 * Accepts audio file buffers and returns timestamped transcription results.
 */

import { Readable } from 'node:stream';
import { toFile } from 'openai';
import type { TranscriptionResult, SpeechOptions } from '../types/ai.types.js';
import { getOpenAIClient } from './openai-client.js';
import { aiEnv } from '../config/ai-env.js';
import { withRetry } from '../utils/retry.js';
import { AIError } from '../utils/ai-error.js';
import { logger } from '../../lib/logger.js';

/** Supported audio MIME types for Whisper. */
export type AudioMimeType =
  | 'audio/flac'
  | 'audio/m4a'
  | 'audio/mp3'
  | 'audio/mp4'
  | 'audio/mpeg'
  | 'audio/mpga'
  | 'audio/ogg'
  | 'audio/wav'
  | 'audio/webm';

export class SpeechService {
  private readonly model: string;

  constructor(model?: string) {
    this.model = model ?? aiEnv.GROQ_WHISPER_MODEL;
  }

  /**
   * Transcribes an audio buffer via OpenAI Whisper.
   *
   * @param audioBuffer  Raw audio bytes (mp3, wav, webm, ogg, flac, m4a supported)
   * @param filename     Filename with extension — Whisper uses this to detect format
   * @param options      Optional language hint, prompt, and granularity settings
   */
  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    options: SpeechOptions = {}
  ): Promise<TranscriptionResult> {
    const client = getOpenAIClient();
    const startMs = Date.now();

    return withRetry(async () => {
      try {
        const file = await toFile(Readable.from(audioBuffer), filename);

        const params = {
          model: this.model,
          file,
          response_format: 'verbose_json' as const,
          ...(options.language ? { language: options.language } : {}),
          ...(options.prompt ? { prompt: options.prompt } : {}),
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
          ...(options.timestampGranularities
            ? { timestamp_granularities: options.timestampGranularities as ('word' | 'segment')[] }
            : {}),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = await (client.audio.transcriptions.create as any)(params) as {
          text: string;
          language?: string;
          duration?: number;
          segments?: Array<{ id: number; start: number; end: number; text: string }>;
        };

        const latencyMs = Date.now() - startMs;
        logger.info({ latencyMs, language: raw.language }, '[SpeechService] Transcription complete');

        return {
          text: raw.text,
          language: raw.language,
          duration: raw.duration,
          segments: raw.segments?.map((s) => ({
            id: s.id,
            start: s.start,
            end: s.end,
            text: s.text,
          })),
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new AIError(msg, 'TRANSCRIPTION_FAILED', { provider: 'groq', retryable: true });
      }
    });
  }
}

export const speechService = new SpeechService();
