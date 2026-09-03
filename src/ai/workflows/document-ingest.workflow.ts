/**
 * @module ai/workflows/document-ingest.workflow
 * @description BullMQ-style async workflow for background document ingestion.
 * Designed to run as a background job — keeps the HTTP response non-blocking.
 *
 * Usage: enqueue a job from an API controller; this workflow is consumed by the worker.
 */

import type { RAGIngestOptions } from '../rag/rag.service.js';
import { ragService } from '../rag/rag.service.js';
import { logger } from '../../lib/logger.js';

export interface DocumentIngestPayload {
  documentId: string;
  content: string;
  tenantId: string;
  uploadedBy: string;
  options?: RAGIngestOptions;
}

export interface DocumentIngestResult {
  documentId: string;
  chunksIndexed: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

/**
 * Executes the full document ingest workflow.
 * This function is called from the BullMQ worker process (not from HTTP handlers).
 */
export async function runDocumentIngestWorkflow(
  payload: DocumentIngestPayload
): Promise<DocumentIngestResult> {
  const startMs = Date.now();

  logger.info(
    { documentId: payload.documentId, tenantId: payload.tenantId },
    '[IngestWorkflow] Starting'
  );

  try {
    const { documentId, chunksIndexed } = await ragService.ingest(
      payload.content,
      payload.documentId,
      {
        ...payload.options,
        metadata: {
          ...payload.options?.metadata,
          tenantId: payload.tenantId,
          uploadedBy: payload.uploadedBy,
          ingestedAt: new Date().toISOString(),
        },
      }
    );

    const latencyMs = Date.now() - startMs;
    logger.info({ documentId, chunksIndexed, latencyMs }, '[IngestWorkflow] Complete');

    return { documentId, chunksIndexed, latencyMs, success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error({ error: msg, documentId: payload.documentId }, '[IngestWorkflow] Failed');
    return {
      documentId: payload.documentId,
      chunksIndexed: 0,
      latencyMs: Date.now() - startMs,
      success: false,
      error: msg,
    };
  }
}
