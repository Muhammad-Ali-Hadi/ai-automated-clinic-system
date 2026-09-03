/**
 * @module ai/memory/conversation-manager
 * @description Per-user / per-patient conversation memory backed by Redis.
 * Features: message persistence, context trimming, automatic summarization.
 */

import type { ConversationSession, ChatMessage, MemoryOptions } from '../types/ai.types.js';
import { getRedisClient } from './redis-client.js';
import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { estimateMessageTokens, trimToContext } from '../utils/token-counter.js';
import { aiEnv } from '../config/ai-env.js';
import { logger } from '../../lib/logger.js';
import { randomUUID } from 'node:crypto';

const SESSION_PREFIX = 'ai:session:';
const TTL_SECONDS = aiEnv.REDIS_TTL_SECONDS;

export class ConversationManager {
  private readonly options: Required<MemoryOptions>;

  constructor(options: MemoryOptions = {}) {
    this.options = {
      maxMessages: options.maxMessages ?? aiEnv.AI_MAX_CONTEXT_MESSAGES,
      maxTokens: options.maxTokens ?? 6_000,
      summarizeAfter: options.summarizeAfter ?? aiEnv.AI_SUMMARIZE_AFTER_MESSAGES,
    };
  }

  /** Create or retrieve a session. */
  async getOrCreate(
    tenantId: string,
    userId: string,
    patientId?: string,
    sessionId?: string
  ): Promise<ConversationSession> {
    const id = sessionId ?? randomUUID();
    const key = `${SESSION_PREFIX}${tenantId}:${id}`;
    const redis = await getRedisClient();

    const raw = await redis.get(key);
    if (raw) {
      return JSON.parse(raw) as ConversationSession;
    }

    const session: ConversationSession = {
      sessionId: id,
      tenantId,
      userId,
      patientId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      tokenCount: 0,
    };

    await this._persist(key, session);
    return session;
  }

  /** Append a user or assistant message and apply memory management. */
  async append(
    session: ConversationSession,
    message: ChatMessage
  ): Promise<ConversationSession> {
    session.messages.push(message);
    session.tokenCount = estimateMessageTokens(session.messages);
    session.updatedAt = new Date();

    // Summarize if conversation is getting long
    if (session.messages.length >= this.options.summarizeAfter) {
      session = await this._summarize(session);
    }

    // Hard trim to context window
    session.messages = trimToContext(session.messages, this.options.maxTokens);
    session.tokenCount = estimateMessageTokens(session.messages);

    const key = `${SESSION_PREFIX}${session.tenantId}:${session.sessionId}`;
    await this._persist(key, session);
    return session;
  }

  /** Return messages ready to send to the LLM (system message + history). */
  getMessages(session: ConversationSession, systemMessage?: ChatMessage): ChatMessage[] {
    const msgs: ChatMessage[] = [];

    if (systemMessage) msgs.push(systemMessage);
    if (session.summary) {
      msgs.push({ role: 'assistant', content: `[Previous conversation summary: ${session.summary}]` });
    }
    msgs.push(...session.messages);

    return msgs;
  }

  /** Delete a session (user logout / session expiry). */
  async delete(tenantId: string, sessionId: string): Promise<void> {
    const redis = await getRedisClient();
    await redis.del(`${SESSION_PREFIX}${tenantId}:${sessionId}`);
    logger.info({ sessionId, tenantId }, '[ConversationManager] Session deleted');
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _persist(key: string, session: ConversationSession): Promise<void> {
    const redis = await getRedisClient();
    await redis.setEx(key, TTL_SECONDS, JSON.stringify(session));
  }

  private async _summarize(session: ConversationSession): Promise<ConversationSession> {
    try {
      const history = session.messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      const msgs = promptManager.render('conversation-summary', { CONVERSATION_HISTORY: history });
      const result = await chatService.complete(msgs, { maxTokens: 400, temperature: 0 });

      session.summary = result.content;
      // Keep only the last 5 messages after summarizing
      session.messages = session.messages.slice(-5);

      logger.info({ sessionId: session.sessionId }, '[ConversationManager] Session summarized');
    } catch (error) {
      logger.error({ error }, '[ConversationManager] Summarization failed — keeping full history');
    }

    return session;
  }
}

export const conversationManager = new ConversationManager();
