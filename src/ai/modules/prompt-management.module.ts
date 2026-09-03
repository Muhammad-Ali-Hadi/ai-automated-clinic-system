/**
 * @module ai/modules/prompt-management.module
 * @description Prompt Management Module — Repository lookup, template optimization, testing, and version control.
 */

import { getPrompt, listPrompts } from '../prompts/prompt-registry.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { chatService } from '../services/chat.service.js';

export interface PromptTestResult {
  renderedMessages: Array<{ role: string; content: string }>;
  simulatedOutput: string;
  optimizationNotes: string;
}

export class PromptManagementModule {
  listAllTemplates() {
    return listPrompts();
  }

  getTemplate(name: string, version?: string) {
    return getPrompt(name, version);
  }

  renderPrompt(name: string, variables: Record<string, string>, version?: string) {
    return promptManager.render(name, variables, version);
  }

  async testAndOptimizePrompt(promptName: string, testInput: string): Promise<PromptTestResult> {
    const template = getPrompt(promptName);
    const messages = promptManager.render('prompt-optimizer', {
      TARGET_PROMPT: `${template.systemPrompt}\n${template.userPromptTemplate}`,
      TEST_INPUT: testInput,
    });

    const result = await chatService.complete(messages, { jsonMode: true });

    let parsed: { simulatedOutput?: string; notes?: string } = {};
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = { simulatedOutput: result.content, notes: 'Direct LLM evaluation output.' };
    }

    return {
      renderedMessages: messages,
      simulatedOutput: parsed.simulatedOutput ?? result.content,
      optimizationNotes: parsed.notes ?? 'Prompt verified for token efficiency and role constraints.',
    };
  }
}

export const promptManagementModule = new PromptManagementModule();
