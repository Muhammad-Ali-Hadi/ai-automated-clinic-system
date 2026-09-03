/**
 * @module ai/utils/ai-error
 * @description Typed AI error classes for structured error handling across the platform.
 */

export type AIErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CONTEXT_LIMIT_EXCEEDED'
  | 'INVALID_REQUEST'
  | 'INVALID_RESPONSE'
  | 'EMBEDDING_FAILED'
  | 'TRANSCRIPTION_FAILED'
  | 'VECTOR_STORE_ERROR'
  | 'MEMORY_ERROR'
  | 'PROMPT_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

export class AIError extends Error {
  public readonly code: AIErrorCode;
  public readonly provider?: string;
  public readonly retryable: boolean;
  public readonly statusCode: number;

  constructor(
    message: string,
    code: AIErrorCode = 'UNKNOWN',
    options: { provider?: string; retryable?: boolean; statusCode?: number } = {}
  ) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.provider = options.provider;
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode ?? 500;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      provider: this.provider,
      retryable: this.retryable,
      statusCode: this.statusCode,
    };
  }
}

export class ProviderUnavailableError extends AIError {
  constructor(provider: string, cause?: unknown) {
    super(`AI provider "${provider}" is currently unavailable.`, 'PROVIDER_UNAVAILABLE', {
      provider,
      retryable: true,
      statusCode: 503,
    });
    if (cause instanceof Error) this.cause = cause;
  }
}

export class RateLimitError extends AIError {
  constructor(provider: string) {
    super(`Rate limit exceeded for provider "${provider}".`, 'RATE_LIMIT_EXCEEDED', {
      provider,
      retryable: true,
      statusCode: 429,
    });
  }
}

export class ContextLimitError extends AIError {
  constructor(tokenCount: number, limit: number) {
    super(
      `Context size ${tokenCount} exceeds model limit of ${limit} tokens.`,
      'CONTEXT_LIMIT_EXCEEDED',
      { retryable: false, statusCode: 400 }
    );
  }
}

export class InvalidAIResponseError extends AIError {
  constructor(detail?: string) {
    super(
      `AI returned an invalid or unparseable response.${detail ? ` Detail: ${detail}` : ''}`,
      'INVALID_RESPONSE',
      { retryable: false, statusCode: 502 }
    );
  }
}

export class VectorStoreError extends AIError {
  constructor(detail?: string) {
    super(
      `Vector store operation failed.${detail ? ` Detail: ${detail}` : ''}`,
      'VECTOR_STORE_ERROR',
      { retryable: true, statusCode: 500 }
    );
  }
}

export class PromptNotFoundError extends AIError {
  constructor(name: string, version?: string) {
    super(
      `Prompt "${name}"${version ? ` v${version}` : ''} not found.`,
      'PROMPT_NOT_FOUND',
      { retryable: false, statusCode: 404 }
    );
  }
}
