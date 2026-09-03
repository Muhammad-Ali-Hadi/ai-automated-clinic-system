/**
 * @module ai/utils/retry
 * @description Exponential back-off retry utility for transient AI provider failures.
 */

import { logger } from '../../lib/logger.js';
import { AIError } from './ai-error.js';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  retryIf?: (error: unknown) => boolean;
}

const defaultRetryIf = (error: unknown): boolean => {
  if (error instanceof AIError) return error.retryable;
  return false;
};

/**
 * Runs `fn` with exponential back-off retry on transient errors.
 * Non-retryable errors propagate immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 500,
    maxDelayMs = 8_000,
    factor = 2,
    retryIf = defaultRetryIf,
  } = options;

  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLast = attempt === maxAttempts;
      const shouldRetry = retryIf(error);

      if (isLast || !shouldRetry) throw error;

      logger.warn(
        { attempt, maxAttempts, delayMs: delay },
        `[AI Retry] Attempt ${attempt} failed — retrying in ${delay}ms`
      );

      await sleep(delay);
      delay = Math.min(delay * factor, maxDelayMs);
    }
  }

  // Unreachable — TypeScript requires explicit throw
  throw new Error('[AI Retry] Unexpected exit from retry loop');
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
