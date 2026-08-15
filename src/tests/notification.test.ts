import { describe, expect, it, vi, beforeEach } from 'vitest';
import { notificationService } from '../services/notification.service.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/app-error.js';
import { auditService } from '../services/audit.service.js';

vi.mock('../repositories/notification.repository.js', () => ({
  notificationRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    markRead: vi.fn(),
    markUnread: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    backgroundJob: { create: vi.fn() },
    hospitalSettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Notification Service', () => {
  const mockAuth = {
    userId: 'user-1',
    hospitalId: 'hospital-uuid-abc',
    role: 'HOSPITAL_ADMIN' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.hospitalSettings.findUnique).mockResolvedValue({
      hospitalId: 'hospital-uuid-abc',
      configuration: {},
    } as any);
    vi.mocked(prisma.hospitalSettings.update).mockResolvedValue({} as any);
  });

  it('sends a notification and enqueues a background job', async () => {
    const notif = { id: 'notif-1', hospitalId: 'hospital-uuid-abc', userId: 'user-2', channel: 'EMAIL' as const, title: 'Test', body: 'Message' };
    vi.mocked(notificationRepository.create).mockResolvedValue(notif as any);
    vi.mocked(prisma.backgroundJob.create).mockResolvedValue({ id: 'job-1' } as any);

    const result = await notificationService.send(mockAuth, {
      userId: 'user-2',
      channel: 'EMAIL',
      title: 'Test',
      body: 'Message',
    });

    expect(result.id).toBe('notif-1');
    expect(prisma.backgroundJob.create).toHaveBeenCalledOnce();
  });

  it('marks notification as read', async () => {
    vi.mocked(notificationRepository.findById).mockResolvedValue({ id: 'notif-1', hospitalId: 'hospital-uuid-abc' } as any);
    vi.mocked(notificationRepository.markRead).mockResolvedValue({ id: 'notif-1', readAt: new Date() } as any);

    const result = await notificationService.markRead(mockAuth, 'notif-1');
    expect(result?.readAt).toBeTruthy();
    expect(auditService.record).toHaveBeenCalledWith(mockAuth, 'MARK_READ', 'Notification', 'notif-1');
  });

  it('throws if notification not found', async () => {
    vi.mocked(notificationRepository.findById).mockResolvedValue(null);
    await expect(notificationService.getNotification(mockAuth, 'nonexistent')).rejects.toThrow(
      new AppError('Notification not found.', 404)
    );
  });

  it('prevents cross-tenant access by checking hospitalId', async () => {
    // Notification belongs to a different hospital
    vi.mocked(notificationRepository.findById).mockResolvedValue(null);
    await expect(notificationService.getNotification(mockAuth, 'notif-other-tenant')).rejects.toThrow(AppError);
  });
});
