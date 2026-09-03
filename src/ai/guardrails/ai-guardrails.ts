/**
 * @module ai/guardrails/ai-guardrails
 * @description Production AI Guardrails — Defense against prompt injection, system prompt leakage,
 * unauthorized tenant data access, and unsafe clinical content.
 */

import { logger } from '../../lib/logger.js';
import { AIError } from '../utils/ai-error.js';

export interface GuardrailValidationResult {
  passed: boolean;
  sanitizedInput?: string;
  violations: string[];
  blockReason?: string;
}

export interface SecurityContext {
  tenantId: string;
  userId: string;
  userRole: string;
  allowedRoles?: string[];
}

/** Standard prompt injection attack signatures */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?prior\s+prompts/i,
  /you\s+are\s+now\s+in\s+DAN\s+mode/i,
  /system\s+override/i,
  /reveal\s+(your\s+)?system\s+prompt/i,
  /print\s+initial\s+instructions/i,
  /bypass\s+safety\s+filter/i,
  /jailbreak/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
];

export class AIGuardrails {
  /**
   * Enforces security, RBAC authorization, injection filtering, and tenant context.
   */
  validateRequest(input: string, securityContext: SecurityContext): GuardrailValidationResult {
    const violations: string[] = [];

    // 1. Tenant Context Check
    if (!securityContext.tenantId || securityContext.tenantId.trim() === '') {
      violations.push('MISSING_TENANT_ID: Every AI request must supply a valid tenantId.');
    }

    // 2. RBAC Enforcement
    if (securityContext.allowedRoles && securityContext.allowedRoles.length > 0) {
      if (!securityContext.allowedRoles.includes(securityContext.userRole)) {
        violations.push(`RBAC_DENIED: Role '${securityContext.userRole}' is not authorized for this AI feature.`);
      }
    }

    // 3. Prompt Injection Defense
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        violations.push(`PROMPT_INJECTION_DETECTED: Input matched suspicious pattern ${pattern.source}`);
        logger.warn(
          { tenantId: securityContext.tenantId, userId: securityContext.userId, pattern: pattern.source },
          '[Guardrails] Prompt injection attempt blocked'
        );
      }
    }

    // 4. System Prompt Protection
    if (/system\s*:\s*you\s*are/i.test(input) || /<<SYS>>/i.test(input)) {
      violations.push('SYSTEM_PROMPT_TAMPERING: Attempted to inject raw system tags.');
    }

    const passed = violations.length === 0;

    return {
      passed,
      violations,
      blockReason: passed ? undefined : violations.join(' | '),
      sanitizedInput: passed ? this._sanitize(input) : undefined,
    };
  }

  /**
   * Validates AI-generated output for unsafe content or system prompt leaks before sending to client.
   */
  validateOutput(output: string): { safe: boolean; sanitizedOutput: string; warnings: string[] } {
    const warnings: string[] = [];
    let safe = true;

    // Guard against system prompt echoing
    if (output.includes('You are the AI Receptionist') || output.includes('You are an intelligent clinical assistant')) {
      warnings.push('SYSTEM_PROMPT_LEAK: Response contained raw system prompt text.');
      safe = false;
    }

    // Guard against unhandled raw JSON syntax errors in user-facing text
    if (output.startsWith('```json') && !output.includes('}')) {
      warnings.push('TRUNCATED_JSON_OUTPUT: Model response JSON was cut off.');
    }

    return {
      safe,
      sanitizedOutput: safe ? output : 'Response filtered due to security policy. Please retry.',
      warnings,
    };
  }

  private _sanitize(input: string): string {
    return input
      .replace(/<\|.*?\|>/g, '')
      .replace(/```system/gi, '')
      .trim();
  }
}

export const aiGuardrails = new AIGuardrails();
