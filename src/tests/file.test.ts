import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fileService } from '../services/file.service.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../services/audit.service.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    fileObject: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// These are unit tests for the fail-closed branch. Keep them deterministic when
// the developer environment has real S3 credentials: integration/runtime tests
// exercise the configured provider separately.
vi.mock('../config/env.js', async () => {
  const actual = await vi.importActual<typeof import('../config/env.js')>('../config/env.js');
  return { ...actual, isStorageConfigured: false };
});

describe('File Management Service', () => {
  const mockAuth = {
    userId: 'user-1',
    hospitalId: 'hospital-uuid-abc',
    role: 'DOCTOR' as const,
  };

  beforeEach(() => vi.clearAllMocks());

  it('fails closed when object storage is not configured', async () => {
    vi.mocked(prisma.fileObject.create).mockResolvedValue({
      id: 'file-1',
      storageKey: 'hospitals/hospital-uuid-abc/files/test.pdf',
    } as any);

    await expect(fileService.stageUpload(mockAuth, {
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024 * 1024,
    })).rejects.toThrow(new AppError('Object storage is not configured.', 503));
  });

  it('rejects disallowed file types', async () => {
    await expect(
      fileService.stageUpload(mockAuth, {
        originalName: 'virus.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
      })
    ).rejects.toThrow(new AppError('File type "application/x-msdownload" is not allowed.', 400));
  });

  it('rejects files exceeding max size', async () => {
    await expect(
      fileService.stageUpload(mockAuth, {
        originalName: 'huge.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 25 * 1024 * 1024, // 25 MB – exceeds 20 MB limit
      })
    ).rejects.toThrow(new AppError('File size exceeds the 20 MB limit.', 400));
  });

  it('returns 404 if file not found', async () => {
    vi.mocked(prisma.fileObject.findFirst).mockResolvedValue(null);
    await expect(fileService.getFile(mockAuth, 'nonexistent')).rejects.toThrow(
      new AppError('File not found.', 404)
    );
  });

  it('normalizes BigInt file sizes for API serialization', async () => {
    vi.mocked(prisma.fileObject.findFirst).mockResolvedValue({
      id: 'file-1',
      storageKey: 'hospitals/hospital-uuid-abc/files/test.pdf',
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(1024),
    } as any);

    const file = await fileService.getFile(mockAuth, 'file-1');
    expect(file.sizeBytes).toBe(1024);
    expect(typeof file.sizeBytes).toBe('number');
  });

  it('fails closed when generating a signed URL without object storage', async () => {
    vi.mocked(prisma.fileObject.findFirst).mockResolvedValue({
      id: 'file-1',
      storageKey: 'hospitals/hospital-uuid-abc/files/test.pdf',
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
    } as any);

    await expect(fileService.getSignedUrl(mockAuth, 'file-1')).rejects.toThrow(
      new AppError('Object storage is not configured.', 503)
    );
  });
});
