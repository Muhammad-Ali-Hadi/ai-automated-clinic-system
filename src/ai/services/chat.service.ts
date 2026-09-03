/**
 * @module ai/services/chat.service
 * @description Core chat completion service. All LLM inference flows through here.
 * Features: provider abstraction, JSON mode, streaming, retry, fallback, latency tracking.
 */

import type { ChatMessage, CompletionOptions, CompletionResult } from '../types/ai.types.js';
import type { AIModel } from '../types/ai.types.js';
import { getOpenAIClient } from './openai-client.js';
import { aiEnv } from '../config/ai-env.js';
import { getModelConfig, getFallbackModel } from '../config/model-registry.js';
import { withRetry } from '../utils/retry.js';
import {
  AIError,
  ProviderUnavailableError,
  RateLimitError,
  InvalidAIResponseError,
} from '../utils/ai-error.js';
import { logger } from '../../lib/logger.js';

export class ChatService {
  /**
   * Sends a chat completion request with retry, latency tracking, and fallback.
   */
  async complete(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const model = (options.model ?? aiEnv.OPENAI_DEFAULT_MODEL) as AIModel;
    const temperature = options.temperature ?? aiEnv.AI_TEMPERATURE;
    const maxTokens = options.maxTokens ?? aiEnv.AI_MAX_TOKENS;

    try {
      return await withRetry(() => this._callOpenAI(messages, model, temperature, maxTokens, options));
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof ProviderUnavailableError) {
        logger.warn({ model }, '[ChatService] Primary model failed — switching to fallback');
        const fallback = getFallbackModel();
        return this._callOpenAI(messages, fallback.id, temperature, maxTokens, options);
      }
      throw error;
    }
  }

  /** Stream a chat completion response for real-time UI updates. */
  async *stream(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): AsyncGenerator<string> {
    const client = getOpenAIClient();
    const model = (options.model ?? aiEnv.OPENAI_DEFAULT_MODEL) as string;

    const stream = await client.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content, name: m.name })),
      temperature: options.temperature ?? aiEnv.AI_TEMPERATURE,
      max_tokens: options.maxTokens ?? aiEnv.AI_MAX_TOKENS,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async _callOpenAI(
    messages: ChatMessage[],
    model: AIModel,
    temperature: number,
    maxTokens: number,
    options: CompletionOptions
  ): Promise<CompletionResult> {
    const client = getOpenAIClient();
    const startMs = Date.now();

    try {
      const cfg = getModelConfig(model);

      const response = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content, name: m.name })),
        temperature,
        max_tokens: maxTokens,
        ...(options.jsonMode && cfg.supportsJsonMode
          ? { response_format: { type: 'json_object' } }
          : {}),
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) throw new InvalidAIResponseError('Empty content in choice');

      return {
        content: choice.message.content,
        model: response.model,
        provider: 'openai',
        latencyMs: Date.now() - startMs,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof AIError) throw error;
      this._mapOpenAIError(error, 'openai');
      throw error; // unreachable but satisfies TS
    }
  }

  /** Map OpenAI SDK errors to typed AIError subclasses. */
  private _mapOpenAIError(error: unknown, provider: string): never {
    const msg = error instanceof Error ? error.message : String(error);
    const status = (error as { status?: number }).status;

    if (status === 429) throw new RateLimitError(provider);
    if (status === 503 || status === 529) throw new ProviderUnavailableError(provider, error);
    throw new AIError(msg, 'INVALID_REQUEST', { provider, statusCode: status ?? 500 });
  }
}

/** Shared singleton instance. */
export const chatService = new ChatService();
