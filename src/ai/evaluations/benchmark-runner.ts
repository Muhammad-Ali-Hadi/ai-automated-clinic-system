/**
 * @module ai/evaluations/benchmark-runner
 * @description Production AI Evaluation Framework — Benchmarks model responses for accuracy,
 * hallucination rates, latency p95, token consumption, and prompt version regressions.
 */

import { evaluateAIResponse } from './ai-response-evaluator.js';
import { promptManager } from '../prompts/prompt-manager.js';
import { chatService } from '../services/chat.service.js';

export interface BenchmarkTestCase {
  id: string;
  promptName: string;
  promptVersion?: string;
  variables: Record<string, string>;
  expectedKeywords?: string[];
  maxAllowedTokens?: number;
  maxAllowedLatencyMs?: number;
  shouldContainDisclaimer?: boolean;
}

export interface BenchmarkResult {
  testId: string;
  passed: boolean;
  accuracyScore: number; // 0.0 to 1.0
  hallucinationRisk: 'NONE' | 'LOW' | 'HIGH';
  latencyMs: number;
  tokensUsed: number;
  disclaimerPresent: boolean;
  failureReasons: string[];
}

export interface SuiteSummary {
  totalTests: number;
  passedCount: number;
  failedCount: number;
  passRatePercent: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalTokens: number;
  results: BenchmarkResult[];
}

export class BenchmarkRunner {
  async runTestCase(test: BenchmarkTestCase): Promise<BenchmarkResult> {
    const startMs = Date.now();
    const failureReasons: string[] = [];

    const messages = promptManager.render(test.promptName, test.variables, test.promptVersion);
    const completion = await chatService.complete(messages, { maxTokens: test.maxAllowedTokens ?? 500 });
    const latencyMs = Date.now() - startMs;

    // Run deterministic evaluation
    const evalResult = evaluateAIResponse(completion.content, test.promptName, {
      requiresDisclaimer: test.shouldContainDisclaimer ?? true,
    });

    if (!evalResult.passed) {
      failureReasons.push(...evalResult.warnings);
    }

    // Check Latency Target
    if (test.maxAllowedLatencyMs && latencyMs > test.maxAllowedLatencyMs) {
      failureReasons.push(`LATENCY_EXCEEDED: Took ${latencyMs}ms (max allowed ${test.maxAllowedLatencyMs}ms)`);
    }

    // Check Keyword Match for Accuracy
    let matchedKeywords = 0;
    if (test.expectedKeywords && test.expectedKeywords.length > 0) {
      for (const kw of test.expectedKeywords) {
        if (completion.content.toLowerCase().includes(kw.toLowerCase())) {
          matchedKeywords++;
        } else {
          failureReasons.push(`MISSING_EXPECTED_KEYWORD: '${kw}'`);
        }
      }
    }

    const accuracyScore = test.expectedKeywords?.length
      ? matchedKeywords / test.expectedKeywords.length
      : evalResult.passed ? 1.0 : 0.5;

    const hallucinationRisk = completion.content.includes('definitely diagnosed') ? 'HIGH' : 'NONE';
    const disclaimerCheck = evalResult.checks.find((c) => c.name === 'disclaimer_present');

    return {
      testId: test.id,
      passed: failureReasons.length === 0,
      accuracyScore,
      hallucinationRisk,
      latencyMs,
      tokensUsed: completion.usage.totalTokens,
      disclaimerPresent: Boolean(disclaimerCheck?.passed),
      failureReasons,
    };
  }

  async runSuite(tests: BenchmarkTestCase[]): Promise<SuiteSummary> {
    const results: BenchmarkResult[] = [];
    let totalTokens = 0;
    const latencies: number[] = [];

    for (const test of tests) {
      const res = await this.runTestCase(test);
      results.push(res);
      totalTokens += res.tokensUsed;
      latencies.push(res.latencyMs);
    }

    latencies.sort((a, b) => a - b);
    const p95Idx = Math.floor(latencies.length * 0.95);
    const p95LatencyMs = latencies[p95Idx] ?? latencies[latencies.length - 1] ?? 0;
    const avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);

    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      totalTests: tests.length,
      passedCount,
      failedCount,
      passRatePercent: Math.round((passedCount / (tests.length || 1)) * 100),
      avgLatencyMs: Math.round(avgLatencyMs),
      p95LatencyMs,
      totalTokens,
      results,
    };
  }
}

export const benchmarkRunner = new BenchmarkRunner();
