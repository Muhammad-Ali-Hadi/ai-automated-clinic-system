/**
 * @module ai/types/ai.types
 * @description Shared type definitions for the Rizocare AI platform.
 */

// ─── Provider ───────────────────────────────────────────────────────────────

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'azure-openai';

export type AIModel =
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4.5-preview'
  | 'claude-3-5-sonnet-20241022'
  | 'gemini-2.0-flash';

// ─── Messages ────────────────────────────────────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  /** Optional name for multi-agent disambiguation */
  name?: string;
}

// ─── Completion ──────────────────────────────────────────────────────────────

export interface CompletionOptions {
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  /** Force JSON mode response format */
  jsonMode?: boolean;
  stream?: boolean;
}

export interface CompletionResult {
  content: string;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
  provider: AIProvider;
}

// ─── Token Tracking ──────────────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ─── Embeddings ──────────────────────────────────────────────────────────────

export interface EmbeddingResult {
  vector: number[];
  model: string;
  usage: Pick<TokenUsage, 'promptTokens' | 'totalTokens'>;
}

export interface BatchEmbeddingResult {
  vectors: number[][];
  model: string;
  usage: Pick<TokenUsage, 'promptTokens' | 'totalTokens'>;
}

// ─── RAG ─────────────────────────────────────────────────────────────────────

export interface RAGDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface RAGChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

export interface RetrievedChunk extends RAGChunk {
  score: number;
}

export interface RAGQueryOptions {
  collectionName: string;
  topK?: number;
  scoreThreshold?: number;
  filter?: Record<string, unknown>;
}

export interface RAGResult {
  chunks: RetrievedChunk[];
  context: string;
}

// ─── Speech ──────────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface SpeechOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
  timestampGranularities?: ('word' | 'segment')[];
}

// ─── Conversation Memory ─────────────────────────────────────────────────────

export interface ConversationSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  patientId?: string;
  messages: ChatMessage[];
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
  tokenCount: number;
}

export interface MemoryOptions {
  maxMessages?: number;
  maxTokens?: number;
  summarizeAfter?: number;
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

export interface PromptTemplate {
  name: string;
  version: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputFormat?: 'text' | 'json' | 'markdown';
  variables: string[];
}

// ─── AI Request / Response (Gateway) ─────────────────────────────────────────

export interface AIRequestContext {
  tenantId: string;
  userId: string;
  patientId?: string;
  requestId: string;
  feature: string;
}

export interface AIServiceRequest {
  context: AIRequestContext;
  messages: ChatMessage[];
  options?: CompletionOptions;
}

export interface AIServiceResponse {
  content: string;
  usage: TokenUsage;
  latencyMs: number;
  model: string;
  provider: AIProvider;
  requestId: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AIUsageRecord {
  requestId: string;
  tenantId: string;
  userId: string;
  feature: string;
  model: string;
  provider: AIProvider;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  createdAt: Date;
}

// ─── Model Registry ──────────────────────────────────────────────────────────

export interface ModelConfig {
  id: AIModel;
  provider: AIProvider;
  contextWindow: number;
  costPerMillionPromptTokens: number;
  costPerMillionCompletionTokens: number;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  isFallback?: boolean;
}
