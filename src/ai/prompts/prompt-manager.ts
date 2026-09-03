/**
 * @module ai/prompts/prompt-manager
 * @description Resolves and renders versioned prompt templates with runtime variables.
 * Variables are injected using the {{VARIABLE_NAME}} syntax.
 */

import type { PromptTemplate, ChatMessage } from '../types/ai.types.js';
import { getPrompt } from './prompt-registry.js';
import { PromptNotFoundError } from '../utils/ai-error.js';

export class PromptManager {
  /**
   * Renders a named prompt template with the supplied variable map,
   * and returns the messages array ready for the chat service.
   */
  render(
    name: string,
    variables: Record<string, string>,
    version?: string
  ): ChatMessage[] {
    let template: PromptTemplate;

    try {
      template = getPrompt(name, version);
    } catch {
      throw new PromptNotFoundError(name, version);
    }

    const systemContent = this._interpolate(template.systemPrompt, variables);
    const userContent = this._interpolate(template.userPromptTemplate, variables);

    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];
  }

  /**
   * Returns only the system message — useful when prepending to an existing
   * conversation history.
   */
  renderSystem(name: string, variables: Record<string, string>, version?: string): ChatMessage {
    let template: PromptTemplate;

    try {
      template = getPrompt(name, version);
    } catch {
      throw new PromptNotFoundError(name, version);
    }

    return {
      role: 'system',
      content: this._interpolate(template.systemPrompt, variables),
    };
  }

  /**
   * Replaces all {{VARIABLE_NAME}} tokens in the template string.
   * Any unreplaced variable tokens are left as-is and logged as a warning.
   */
  private _interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key: string) => {
      const value = variables[key];
      if (value === undefined) {
        console.warn(`[PromptManager] Unresolved variable "{{${key}}}" in template.`);
        return `[${key}]`;
      }
      return value;
    });
  }
}

export const promptManager = new PromptManager();
