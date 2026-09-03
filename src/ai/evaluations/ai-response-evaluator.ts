/**
 * @module ai/evaluations/ai-response-evaluator
 * @description Automated quality evaluation for AI-generated clinical responses.
 * Evaluates: hallucination risk, disclaimer presence, and length adequacy.
 * Used in CI pipelines and optional production monitoring.
 */

export interface EvaluationResult {
  passed: boolean;
  score: number; // 0–100
  checks: EvaluationCheck[];
  warnings: string[];
}

export interface EvaluationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

/**
 * Evaluates an AI response against quality and safety criteria.
 * Does NOT call an LLM — all checks are deterministic string/regex analysis.
 */
export function evaluateAIResponse(
  content: string,
  feature: string,
  options: { requiresDisclaimer?: boolean; minLength?: number; maxLength?: number } = {}
): EvaluationResult {
  const { requiresDisclaimer = true, minLength = 50, maxLength = 8_000 } = options;

  const checks: EvaluationCheck[] = [];
  const warnings: string[] = [];

  // Check 1: Disclaimer present
  if (requiresDisclaimer) {
    const hasDisclaimer =
      /draft|suggestion|review|AI-generated|does not constitute|clinical judgment/i.test(content);
    checks.push({
      name: 'disclaimer_present',
      passed: hasDisclaimer,
      detail: hasDisclaimer
        ? 'Response contains clinical advisory language.'
        : 'Response is missing a clinical disclaimer.',
    });
    if (!hasDisclaimer) warnings.push('Missing clinical disclaimer. Add before presenting to clinician.');
  }

  // Check 2: Not empty
  const notEmpty = content.trim().length >= minLength;
  checks.push({
    name: 'content_length',
    passed: notEmpty,
    detail: notEmpty
      ? `Content length ${content.length} chars is adequate.`
      : `Content is too short (${content.length} < ${minLength} chars).`,
  });

  // Check 3: Not excessively long
  const notTooLong = content.length <= maxLength;
  checks.push({
    name: 'content_max_length',
    passed: notTooLong,
    detail: notTooLong
      ? 'Content length within limits.'
      : `Content exceeds max length (${content.length} > ${maxLength} chars).`,
  });

  // Check 4: No definitive diagnosis language (high-risk phrases)
  const diagnosisPatterns = [
    /\bthe patient has\b/i,
    /\bdiagnosis is\b/i,
    /\bdefinitely\b.*\bdisease\b/i,
    /\bconfirmed\b.*\bdiagnosis\b/i,
  ];
  const noDiagnosticAssertion = !diagnosisPatterns.some((p) => p.test(content));
  checks.push({
    name: 'no_definitive_diagnosis',
    passed: noDiagnosticAssertion,
    detail: noDiagnosticAssertion
      ? 'No definitive diagnosis language detected.'
      : 'Response contains potentially definitive diagnostic language — review required.',
  });
  if (!noDiagnosticAssertion) warnings.push('Potential definitive diagnosis language found. Must be reviewed.');

  // Check 5: No hallucinated citations (e.g. fake journal refs like [PMID 999999999])
  const hasSuspectCitation = /\[PMID\s+\d{9,}\]/i.test(content);
  checks.push({
    name: 'no_suspicious_citations',
    passed: !hasSuspectCitation,
    detail: hasSuspectCitation
      ? 'Suspicious citation pattern detected — verify before use.'
      : 'No suspicious citation patterns found.',
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const passed = checks.every((c) => c.passed);

  return { passed, score, checks, warnings };
}
