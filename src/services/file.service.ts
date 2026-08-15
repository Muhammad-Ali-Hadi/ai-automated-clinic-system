import { AppError } from '../utils/app-error.js';
import { auditService, type TenantAuth } from './audit.service.js';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { presignS3Url } from '../lib/s3.js';
import { env, isStorageConfigured } from '../config/env.js';

const hid = (auth: TenantAuth) => {
  if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
  return auth.hospitalId;
};

/** Allowed MIME types for upload */
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Storage provider abstraction.
 * Real signed URL generation requires S3-compatible credentials set via env vars:
 *   S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   or compatible STORAGE_ENDPOINT (e.g. Supabase Storage, MinIO).
 *
 * File operations require configured storage; this service never returns fake URLs.
 */
const buildConfig = () => {
  if (!isStorageConfigured) return null;
  const cfg = {
    bucket: env.S3_BUCKET!,
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    region: env.S3_REGION,
  } as const;
  const endpoint = env.S3_ENDPOINT;
  return endpoint ? { ...cfg, endpoint } : cfg;
};

const storageProvider = {
  isConfigured: () => buildConfig() !== null,

  generateUploadUrl: (storageKey: string, contentType?: string): string => {
    const cfg = buildConfig();
    if (!cfg) throw new AppError('Object storage is not configured.', 503);
    return presignS3Url(cfg, 'PUT', storageKey, contentType);
  },

  generateDownloadUrl: (storageKey: string): string => {
    const cfg = buildConfig();
    if (!cfg) throw new AppError('Object storage is not configured.', 503);
    return presignS3Url(cfg, 'GET', storageKey);
  },
  async deleteObject(storageKey: string): Promise<void> {
    const cfg = buildConfig();
    if (!cfg) throw new AppError('Object storage is not configured.', 503);
    const response = await fetch(presignS3Url(cfg, 'DELETE', storageKey), { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new AppError('Object storage deletion failed.', 502);
    }
  },
};

export const fileService = {
  /**
   * Stage a file upload - validates metadata, persists FileObject record,
   * and returns a pre-signed upload URL.
   */
  async stageUpload(
    auth: TenantAuth,
    input: {
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      patientId?: string;
      labTestId?: string;
      category?: string;
    }
  ) {
    const hospitalId = hid(auth);

    if (!ALLOWED_TYPES.has(input.mimeType)) {
      throw new AppError(`File type "${input.mimeType}" is not allowed.`, 400);
    }
    if (input.labTestId) {
      const labTest = await prisma.labTest.findFirst({ where: { id: input.labTestId, hospitalId } });
      if (!labTest) throw new AppError('Laboratory test not found.', 404);
      if (!input.patientId) input.patientId = labTest.patientId;
    }

    if (input.sizeBytes > MAX_SIZE_BYTES) {
      throw new AppError(`File size exceeds the 20 MB limit.`, 400);
    }
    if (!storageProvider.isConfigured()) throw new AppError('Object storage is not configured.', 503);
    if (input.patientId) {
      const patient = await prisma.patient.findFirst({ where: { id: input.patientId, hospitalId, deletedAt: null }, select: { id: true } });
      if (!patient) throw new AppError('Patient not found.', 404);
    }

    const ext = input.originalName.split('.').pop() ?? 'bin';
    const storageKey = `hospitals/${hospitalId}/files/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const fileObj = await prisma.fileObject.create({
      data: {
        hospitalId,
        uploadedById: auth.userId,
        storageKey,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        patientId: input.patientId,
        labTestId: input.labTestId,
        category: input.category,
      },
    });

    const uploadUrl = storageProvider.generateUploadUrl(storageKey);

    await auditService.record(auth, 'STAGE_UPLOAD', 'FileObject', fileObj.id);
    return {
      fileId: fileObj.id,
      storageKey,
      uploadUrl,
      storageConfigured: storageProvider.isConfigured(),
    };
  },

  async getFile(auth: TenantAuth, id: string) {
    const file = await prisma.fileObject.findFirst({
      where: { id, hospitalId: hid(auth) },
    });
    if (!file) throw new AppError('File not found.', 404);
    return { ...file, sizeBytes: Number(file.sizeBytes) };
  },

  async getSignedUrl(auth: TenantAuth, id: string) {
    const file = await this.getFile(auth, id);
    const url = storageProvider.generateDownloadUrl(file.storageKey);
    await auditService.record(auth, 'GENERATE_SIGNED_URL', 'FileObject', id);
    return {
      url,
      originalName: file.originalName,
      mimeType: file.mimeType,
      storageConfigured: storageProvider.isConfigured(),
    };
  },

  async listFiles(
    auth: TenantAuth,
    query: {
      page?: number;
      limit?: number;
      patientId?: string;
      labTestId?: string;
      category?: string;
      mimeType?: string;
    }
  ) {
    const hospitalId = hid(auth);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = {
      hospitalId,
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.mimeType ? { mimeType: { contains: query.mimeType, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.fileObject.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          patientId: true,
          createdAt: true,
          uploadedById: true,
          labTestId: true,
          category: true,
        },
      }),
      prisma.fileObject.count({ where }),
    ]);

    return {
      data: data.map((f) => ({ ...f, sizeBytes: Number(f.sizeBytes) })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async deleteFile(auth: TenantAuth, id: string) {
    const file = await prisma.fileObject.findFirst({ where: { id, hospitalId: hid(auth) } });
    if (!file) throw new AppError('File not found.', 404);
    await storageProvider.deleteObject(file.storageKey);
    await prisma.fileObject.deleteMany({ where: { id, hospitalId: hid(auth) } });
    await auditService.record(auth, 'DELETE', 'FileObject', id);
  },
};
