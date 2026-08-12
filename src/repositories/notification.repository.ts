import { prisma } from '../lib/prisma.js';
import type { NotificationChannel } from '@prisma/client';

export const notificationRepository = {
  create: (data: {
    userId: string;
    hospitalId?: string;
    channel: NotificationChannel;
    title: string;
    body: string;
  }) =>
    prisma.notification.create({ data }),

  findById: (id: string, hospitalId?: string) =>
    prisma.notification.findFirst({
      where: {
        id,
        ...(hospitalId ? { hospitalId } : {}),
      },
    }),

  markRead: async (id: string, hospitalId: string) => {
    await prisma.notification.updateMany({
      where: { id, hospitalId },
      data: { readAt: new Date() },
    });
    return prisma.notification.findFirst({ where: { id, hospitalId } });
  },

  markUnread: async (id: string, hospitalId: string) => {
    await prisma.notification.updateMany({
      where: { id, hospitalId },
      data: { readAt: null },
    });
    return prisma.notification.findFirst({ where: { id, hospitalId } });
  },

  list: (
    hospitalId: string | undefined,
    userId: string | undefined,
    skip: number,
    take: number,
    filters: { channel?: NotificationChannel; unreadOnly?: boolean } = {}
  ) =>
    prisma.notification.findMany({
      where: {
        ...(hospitalId ? { hospitalId } : {}),
        ...(userId ? { userId } : {}),
        ...(filters.channel ? { channel: filters.channel } : {}),
        ...(filters.unreadOnly ? { readAt: null } : {}),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),

  count: (
    hospitalId: string | undefined,
    userId: string | undefined,
    filters: { channel?: NotificationChannel; unreadOnly?: boolean } = {}
  ) =>
    prisma.notification.count({
      where: {
        ...(hospitalId ? { hospitalId } : {}),
        ...(userId ? { userId } : {}),
        ...(filters.channel ? { channel: filters.channel } : {}),
        ...(filters.unreadOnly ? { readAt: null } : {}),
      },
    }),
};
