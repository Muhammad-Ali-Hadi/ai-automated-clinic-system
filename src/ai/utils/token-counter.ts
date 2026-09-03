/**
 * @module ai/utils/token-counter
 * @description Lightweight token estimation utilities.
 * Uses a simple heuristic (4 chars ≈ 1 token) for fast pre-flight checks.
 * For accurate counts, use the usage object returned by the provider API.
 */

import type { ChatMessage } from '../types/ai.types.js';

/** Rough heuristic: ~4 chars per token (GPT tokenizer average). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Estimate total token count for a message array (includes role overhead). */
export function estimateMessageTokens(messages: ChatMessage[]): number {
  // 4 tokens overhead per message (role + framing)
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

/** Return true if messages fit within the given token budget. */
export function fitsInContext(messages: ChatMessage[], maxTokens: number): boolean {
  return estimateMessageTokens(messages) <= maxTokens;
}

/**
 * Trim oldest non-system messages until content fits within `maxTokens`.
 * The system message (index 0) is always preserved.
 */
export function trimToContext(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  const trimmed = [...messages];

  while (trimmed.length > 1 && !fitsInContext(trimmed, maxTokens)) {
    // Remove the oldest non-system message (index 1 when system is at 0)
    const removeIdx = trimmed[0]?.role === 'system' ? 1 : 0;
    trimmed.splice(removeIdx, 1);
  }

  return trimmed;
}
