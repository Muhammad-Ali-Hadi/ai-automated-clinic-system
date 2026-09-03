/**
 * @module ai/modules/conversation-memory.module
 * @description Conversation Memory Module — Session management, summarization, context compression, and search.
 */

import { conversationManager } from '../memory/conversation-manager.js';
import type { ConversationSession, ChatMessage } from '../types/ai.types.js';
import { chatService } from '../services/chat.service.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { estimateMessageTokens } from '../utils/token-counter.js';

export class ConversationMemoryModule {
  async getOrCreateSession(
    tenantId: string,
    userId: string,
    patientId?: string,
    sessionId?: string
  ): Promise<ConversationSession> {
    return conversationManager.getOrCreate(tenantId, userId, patientId, sessionId);
  }

  async appendMessage(session: ConversationSession, message: ChatMessage): Promise<ConversationSession> {
    return conversationManager.append(session, message);
  }

  async compressContext(session: ConversationSession): Promise<{ compressedSummary: string; tokenCount: number }> {
    const historyText = session.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const messages = promptManager.render('conversation-summary', { CONVERSATION_HISTORY: historyText });

    const result = await chatService.complete(messages, { maxTokens: 300 });
    session.summary = result.content;
    session.messages = session.messages.slice(-3); // Retain last 3 messages after compression

    return {
      compressedSummary: result.content,
      tokenCount: estimateMessageTokens(session.messages),
    };
  }

  async deleteSession(tenantId: string, sessionId: string): Promise<void> {
    await conversationManager.delete(tenantId, sessionId);
  }
}

export const conversationMemoryModule = new ConversationMemoryModule();
