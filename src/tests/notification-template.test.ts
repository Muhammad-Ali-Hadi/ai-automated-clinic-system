import { describe, expect, it, vi, beforeEach } from 'vitest';
import { notificationTemplateService } from '../services/notification-template.service.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';

vi.mock('../services/audit.service.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    notificationTemplate: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('Notification Template Service', () => {
  const mockAuth = { userId: 'user-1', hospitalId: 'hospital-uuid-abc', role: 'HOSPITAL_ADMIN' as const };

  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a notification template successfully', async () => {
    const template = {
      id: 'tpl-1', hospitalId: 'hospital-uuid-abc', name: 'welcome',
      body: 'Hello!', channel: 'EMAIL' as const, status: 'ACTIVE' as const,
    };
    vi.mocked(prisma.notificationTemplate.create).mockResolvedValue(template as any);

    const result = await notificationTemplateService.createTemplate(mockAuth, {
      name: 'welcome', body: 'Hello!', channel: 'EMAIL',
    });

    expect(result.id).toBe('tpl-1');
    expect(result.name).toBe('welcome');
  });

  it('returns templates list with pagination', async () => {
    vi.mocked(prisma.notificationTemplate.findMany).mockResolvedValue([{ id: 'tpl-1' }] as any);
    vi.mocked(prisma.notificationTemplate.count).mockResolvedValue(1);

    const result = await notificationTemplateService.listTemplates(mockAuth, {});
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('throws 404 for a template not found', async () => {
    vi.mocked(prisma.notificationTemplate.findFirst).mockResolvedValue(null);
    await expect(notificationTemplateService.getTemplate(mockAuth, 'nonexistent'))
      .rejects.toThrow(new AppError('Notification template not found.', 404));
  });

  it('enforces tenant scoping on find', async () => {
    vi.mocked(prisma.notificationTemplate.findFirst).mockResolvedValue(null);
    await expect(notificationTemplateService.getTemplate(mockAuth, 'tpl-other-tenant'))
      .rejects.toThrow(new AppError('Notification template not found.', 404));
  });
});
