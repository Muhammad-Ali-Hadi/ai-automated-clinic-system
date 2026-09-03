/**
 * @module ai/config/ai-env
 * @description AI-specific environment variable schema and validation.
 * Extends the base env config with AI provider credentials and tuning params.
 */

import { z } from 'zod';
import 'dotenv/config';

const optionalText = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().min(1).optional()
);

const aiEnvSchema = z.object({
  // ── OpenAI ──────────────────────────────────────────────────────────────────
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_DEFAULT_MODEL: z.string().min(1).default('gpt-4.1-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  OPENAI_WHISPER_MODEL: z.string().min(1).default('whisper-1'),

  // ── Anthropic (optional future provider) ─────────────────────────────────
  ANTHROPIC_API_KEY: optionalText,

  // ── Google Gemini (optional future provider) ──────────────────────────────
  GEMINI_API_KEY: optionalText,

  // ── Azure OpenAI (optional future provider) ───────────────────────────────
  AZURE_OPENAI_API_KEY: optionalText,
  AZURE_OPENAI_ENDPOINT: optionalText,
  AZURE_OPENAI_DEPLOYMENT: optionalText,

  // ── Qdrant Vector DB ─────────────────────────────────────────────────────
  QDRANT_URL: z.string().url().default('http://localhost:6333'),
  QDRANT_API_KEY: optionalText,
  QDRANT_DEFAULT_COLLECTION: z.string().min(1).default('rizocare_knowledge'),

  // ── Redis (conversation memory + response cache) ──────────────────────────
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),

  // ── MongoDB (AI usage logs, conversation history) ─────────────────────────
  MONGO_URL: optionalText,
  MONGO_AI_DB: z.string().min(1).default('rizocare_ai'),

  // ── AI Tuning ─────────────────────────────────────────────────────────────
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(2_048),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
  AI_MAX_CONTEXT_MESSAGES: z.coerce.number().int().positive().default(20),
  AI_SUMMARIZE_AFTER_MESSAGES: z.coerce.number().int().positive().default(15),
  AI_CACHE_ENABLED: z.preprocess(
    (v) => v === 'true' || v === true,
    z.boolean().default(true)
  ),
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // ── RAG ───────────────────────────────────────────────────────────────────
  RAG_TOP_K: z.coerce.number().int().positive().default(5),
  RAG_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  RAG_CHUNK_SIZE: z.coerce.number().int().positive().default(1_500),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).default(200),
});

export type AIEnv = z.infer<typeof aiEnvSchema>;

const result = aiEnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('[AI Config] Invalid AI environment variables:\n', result.error.format());
  // Non-fatal — missing optional provider keys are acceptable in dev.
  // Critical keys (OPENAI_API_KEY) will still surface as Zod errors.
}

export const aiEnv: AIEnv = aiEnvSchema.parse(process.env);
