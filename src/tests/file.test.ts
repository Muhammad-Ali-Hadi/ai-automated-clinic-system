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

describe('File Management Service', () => {
  const mockAuth = {
    userId: 'user-1',
    hospitalId: 'hospital-uuid-abc',
    role: 'DOCTOR' as const,
  };

  beforeEach(() => vi.clearAllMocks());

  it('stages a file upload and returns a pre-signed URL', async () => {
    vi.mocked(prisma.fileObject.create).mockResolvedValue({
      id: 'file-1',
      storageKey: 'hospitals/hospital-uuid-abc/files/test.pdf',
    } as any);

    const result = await fileService.stageUpload(mockAuth, {
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024 * 1024,
    });

    expect(result.fileId).toBe('file-1');
    expect(result.uploadUrl).toBeTruthy();
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

  it('generates a signed download URL', async () => {
    vi.mocked(prisma.fileObject.findFirst).mockResolvedValue({
      id: 'file-1',
      storageKey: 'hospitals/hospital-uuid-abc/files/test.pdf',
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
    } as any);

    const result = await fileService.getSignedUrl(mockAuth, 'file-1');
    expect(result.url).toBeTruthy();
    expect(result.originalName).toBe('test.pdf');
  });
});
