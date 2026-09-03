/**
 * @module ai/config/model-registry
 * @description Central registry of supported AI models, their capabilities,
 * and cost parameters. Swap providers here — business logic is unaffected.
 */

import type { ModelConfig, AIModel } from '../types/ai.types.js';

/** All models known to the platform. */
export const MODEL_REGISTRY: Record<AIModel, ModelConfig> = {
  'gpt-4.1': {
    id: 'gpt-4.1',
    provider: 'openai',
    contextWindow: 1_047_576,
    costPerMillionPromptTokens: 2.0,
    costPerMillionCompletionTokens: 8.0,
    supportsJsonMode: true,
    supportsStreaming: true,
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    contextWindow: 1_047_576,
    costPerMillionPromptTokens: 0.4,
    costPerMillionCompletionTokens: 1.6,
    supportsJsonMode: true,
    supportsStreaming: true,
    isFallback: true,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    contextWindow: 128_000,
    costPerMillionPromptTokens: 2.5,
    costPerMillionCompletionTokens: 10.0,
    supportsJsonMode: true,
    supportsStreaming: true,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    contextWindow: 128_000,
    costPerMillionPromptTokens: 0.15,
    costPerMillionCompletionTokens: 0.6,
    supportsJsonMode: true,
    supportsStreaming: true,
    isFallback: true,
  },
  'gpt-4.5-preview': {
    id: 'gpt-4.5-preview',
    provider: 'openai',
    contextWindow: 128_000,
    costPerMillionPromptTokens: 75.0,
    costPerMillionCompletionTokens: 150.0,
    supportsJsonMode: true,
    supportsStreaming: true,
  },
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    contextWindow: 200_000,
    costPerMillionPromptTokens: 3.0,
    costPerMillionCompletionTokens: 15.0,
    supportsJsonMode: false,
    supportsStreaming: true,
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    contextWindow: 1_000_000,
    costPerMillionPromptTokens: 0.075,
    costPerMillionCompletionTokens: 0.3,
    supportsJsonMode: true,
    supportsStreaming: true,
  },
};

/** Retrieve model config; throws if model is not registered. */
export function getModelConfig(model: AIModel): ModelConfig {
  const config = MODEL_REGISTRY[model];
  if (!config) throw new Error(`Model "${model}" is not registered in the model registry.`);
  return config;
}

/** Returns the cheapest fallback model from the registry. */
export function getFallbackModel(): ModelConfig {
  const fallbacks = Object.values(MODEL_REGISTRY).filter((m) => m.isFallback);
  if (fallbacks.length === 0) throw new Error('No fallback model configured in registry.');
  return fallbacks.sort((a, b) => a.costPerMillionPromptTokens - b.costPerMillionPromptTokens)[0]!;
}

/** Estimate cost in USD for a given token usage. */
export function estimateCostUsd(
  model: AIModel,
  promptTokens: number,
  completionTokens: number
): number {
  const cfg = getModelConfig(model);
  return (
    (promptTokens / 1_000_000) * cfg.costPerMillionPromptTokens +
    (completionTokens / 1_000_000) * cfg.costPerMillionCompletionTokens
  );
}
