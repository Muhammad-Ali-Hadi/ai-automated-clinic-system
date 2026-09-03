/**
 * @module ai/utils/sanitize
 * @description Input/output sanitization helpers to guard against prompt injection
 * and ensure no sensitive patient data leaks into logs.
 */

/** Maximum safe input length (characters) before truncation. */
const MAX_INPUT_CHARS = 12_000;

/**
 * Strips characters commonly used in prompt injection attacks and trims whitespace.
 * Does NOT remove medical terminology — only structural injection patterns.
 */
export function sanitizeUserInput(input: string): string {
  return input
    .slice(0, MAX_INPUT_CHARS)
    .replace(/\n{3,}/g, '\n\n')          // Collapse excessive newlines
    .replace(/<\|.*?\|>/g, '')            // Remove LLM control tokens
    .replace(/```system\b/gi, '')         // Strip embedded system blocks
    .trim();
}

/**
 * Redacts common PII patterns from a string before writing to logs.
 * Patterns: email, phone, national ID digits, and credit card numbers.
 */
export function redactForLog(text: string): string {
  return text
    .replace(/\b[\w.+-]+@[\w-]+\.\w{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{11,13}\b/g, '[ID_NUMBER]')          // CNIC / long digit sequences
    .replace(/\b(?:\+92|0)\s?\d{3}[\s-]?\d{7}\b/g, '[PHONE]')
    .replace(/\b(?:\d{4}[\s-]){3}\d{4}\b/g, '[CARD]');
}

/**
 * Ensures AI-generated content is not presented as definitive medical diagnosis.
 * Prepends a standard advisory note when the content lacks it.
 */
export function wrapAsDraft(content: string, feature: string): string {
  const advisory =
    `⚠️ AI-Generated Draft (${feature}): This content is a suggestion for clinical review ` +
    `and does not constitute a medical diagnosis or professional clinical judgment.\n\n`;

  const alreadyWrapped =
    content.startsWith('⚠️ AI-Generated') || content.includes('AI suggestion');

  return alreadyWrapped ? content : advisory + content;
}
