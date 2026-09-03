/**
 * @module ai/services/openai-client
 * @description Singleton OpenAI SDK client factory.
 * All AI services must import from here — never instantiate OpenAI directly.
 */

import OpenAI from 'openai';
import { aiEnv } from '../config/ai-env.js';

let _client: OpenAI | null = null;

/** Returns the shared OpenAI client instance. */
export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: aiEnv.OPENAI_API_KEY,
      maxRetries: 0,           // Retry logic handled by withRetry utility
      timeout: 30_000,         // 30 s hard timeout per request
    });
  }
  return _client;
}
