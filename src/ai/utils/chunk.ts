/**
 * @module ai/utils/chunk
 * @description Text chunking utilities for RAG document ingestion.
 * Supports fixed-size chunking with configurable overlap.
 */

import type { RAGChunk } from '../types/ai.types.js';
import { randomUUID } from 'node:crypto';

export interface ChunkOptions {
  /** Target characters per chunk (default 1 500). */
  chunkSize?: number;
  /** Characters to overlap between consecutive chunks (default 200). */
  overlap?: number;
}

/**
 * Splits `content` into overlapping character-level chunks and
 * attaches metadata for downstream vector indexing.
 */
export function chunkDocument(
  documentId: string,
  content: string,
  metadata: Record<string, unknown> = {},
  options: ChunkOptions = {}
): RAGChunk[] {
  const { chunkSize = 1_500, overlap = 200 } = options;

  if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new RangeError('Invalid chunk options: chunkSize must be positive and overlap < chunkSize.');
  }

  const chunks: RAGChunk[] = [];
  const step = chunkSize - overlap;
  let idx = 0;
  let chunkIndex = 0;

  while (idx < content.length) {
    const end = Math.min(idx + chunkSize, content.length);
    const slice = content.slice(idx, end).trim();

    if (slice.length > 0) {
      chunks.push({
        id: randomUUID(),
        documentId,
        content: slice,
        chunkIndex,
        metadata: { ...metadata, chunkIndex, charStart: idx, charEnd: end },
      });
      chunkIndex++;
    }

    idx += step;
    if (idx >= content.length) break;
  }

  return chunks;
}

/**
 * Sentence-aware chunking: splits on sentence boundaries (. ! ?)
 * then groups sentences until `chunkSize` chars is reached.
 */
export function chunkBySentence(
  documentId: string,
  content: string,
  metadata: Record<string, unknown> = {},
  chunkSize = 1_500
): RAGChunk[] {
  const sentences = content.match(/[^.!?]+[.!?]+/g) ?? [content];
  const chunks: RAGChunk[] = [];
  let buffer = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    if (buffer.length + sentence.length > chunkSize && buffer.length > 0) {
      chunks.push({
        id: randomUUID(),
        documentId,
        content: buffer.trim(),
        chunkIndex,
        metadata: { ...metadata, chunkIndex },
      });
      chunkIndex++;
      buffer = '';
    }
    buffer += sentence;
  }

  if (buffer.trim().length > 0) {
    chunks.push({
      id: randomUUID(),
      documentId,
      content: buffer.trim(),
      chunkIndex,
      metadata: { ...metadata, chunkIndex },
    });
  }

  return chunks;
}
