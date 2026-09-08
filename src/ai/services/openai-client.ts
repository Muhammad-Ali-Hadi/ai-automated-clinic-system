/**
 * @module ai/services/openai-client
 * @description Singleton OpenAI-SDK client factory, configured to use the Groq API.
 * Groq exposes a fully OpenAI-compatible REST interface — no other service files need changing.
 * All AI services must import from here — never instantiate OpenAI directly.
 */

import OpenAI from 'openai';
import { aiEnv } from '../config/ai-env.js';

let _client: OpenAI | null = null;

/** Returns the shared Groq client instance (OpenAI SDK pointed at Groq). */
export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: aiEnv.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      maxRetries: 0,           // Retry logic handled by withRetry utility
      timeout: 30_000,         // 30 s hard timeout per request
    });
  }
  return _client;
}
