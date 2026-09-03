import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/apiClient';

export interface AiStatus {
  openai: { configured: boolean; chatModel: string; embeddingModel: string; whisperModel: string };
  memory: { mode: 'redis' | 'memory' | 'unknown' };
  vectorStore: { url: string; collection: string };
  capabilities: string[];
}

/** Shape shared by the gateway methods; module methods add their own fields. */
export interface AiResult {
  content?: string;
  answer?: string;
  responseMessage?: string;
  summary?: string;
  transcript?: string;
  text?: string;
  retrievedChunks?: number;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs?: number;
  model?: string;
  provider?: string;
  [k: string]: unknown;
}

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => apiGet<AiStatus>('/ai/status'),
    staleTime: 60_000,
  });
}

export const aiApi = {
  chat: (body: { message: string; sessionId?: string; patientId?: string; department?: string }) =>
    apiPost<AiResult>('/ai/chat', body),
  receptionist: (body: { patientQuery: string; sessionId?: string }) =>
    apiPost<AiResult>('/ai/receptionist', body),
  dischargeSummary: (body: Record<string, string>) => apiPost<AiResult>('/ai/discharge-summary', body),
  labInterpretation: (body: Record<string, string>) => apiPost<AiResult>('/ai/lab-interpretation', body),
  labAnalysis: (body: Record<string, string>) => apiPost<AiResult>('/ai/lab-analysis', body),
  prescriptionDraft: (body: Record<string, string>) => apiPost<AiResult>('/ai/prescription-draft', body),
  patientExplainer: (body: Record<string, string>) => apiPost<AiResult>('/ai/patient-explainer', body),
  billing: (body: Record<string, string>) => apiPost<AiResult>('/ai/billing', body),
  pharmacy: (body: Record<string, string>) => apiPost<AiResult>('/ai/pharmacy', body),
  document: (body: Record<string, string>) => apiPost<AiResult>('/ai/document', body),
  smartSearch: (body: { naturalLanguageQuery: string }) => apiPost<AiResult>('/ai/smart-search', body),
  analytics: (body: Record<string, string>) => apiPost<AiResult>('/ai/analytics', body),
  knowledgeQuery: (body: { question: string }) => apiPost<AiResult>('/ai/knowledge/query', body),
  knowledgeIngest: (body: { content: string; title?: string; category?: string }) =>
    apiPost<AiResult>('/ai/knowledge/ingest', body),
  transcribe: (body: { audioBase64: string; filename?: string; language?: string }) =>
    apiPost<AiResult>('/ai/transcribe', body),
};

/** Pull the best human-readable text out of a mixed AI result. */
export function primaryText(r: AiResult | undefined): string {
  if (!r) return '';
  return (
    r.content ??
    r.answer ??
    r.responseMessage ??
    r.summary ??
    r.transcript ??
    r.text ??
    (typeof r.result === 'string' ? r.result : '') ??
    ''
  );
}
