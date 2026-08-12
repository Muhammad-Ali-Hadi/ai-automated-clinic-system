import { prisma } from '../lib/prisma.js';
export const userRepository = {
  findByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),
  updateProfile: (id: string, data: { firstName?: string; lastName?: string }) => prisma.user.update({ where: { id }, data }),
  updatePassword: (id: string, passwordHash: string) => prisma.user.update({ where: { id }, data: { passwordHash } }),
  create: (data: { email: string; passwordHash: string; firstName: string; lastName: string; role: 'HOSPITAL_ADMIN'; hospitalId: string }) => prisma.user.create({ data }),
  createSession: (data: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string; ipAddress?: string }) => prisma.session.create({ data }),
  updateSessionToken: (id: string, tokenHash: string) => prisma.session.update({ where: { id }, data: { tokenHash } }),
  session: (id: string) => prisma.session.findUnique({ where: { id } }),
  revokeSession: (id: string) => prisma.session.update({ where: { id }, data: { revokedAt: new Date() } }),
  revokeAll: (userId: string) => prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  loginEvent: (data: { userId?: string; email: string; success: boolean; ipAddress?: string }) => prisma.loginEvent.create({ data }),
  createUser: (data: { email: string; passwordHash: string; firstName: string; lastName: string; role: string; hospitalId?: string | null }) =>
    prisma.user.create({ data: data as any }),
  updateRole: (userId: string, hospitalId: string, role: string) =>
    prisma.user.updateMany({ where: { id: userId, hospitalId }, data: { role: role as any } }),
  listUsers: (hospitalId: string, skip: number, take: number, search?: string) =>
    prisma.user.findMany({
      where: { hospitalId, ...(search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } : {}) },
      orderBy: { createdAt: 'desc' }, skip, take,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, emailVerifiedAt: true, createdAt: true },
    }),
  countUsers: (hospitalId: string, search?: string) =>
    prisma.user.count({ where: { hospitalId, ...(search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } : {}) } }),
  findByIdInTenant: (userId: string, hospitalId: string) =>
    prisma.user.findFirst({ where: { id: userId, hospitalId } }),
  setEmailVerified: (userId: string) =>
    prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
  // Password reset tokens
  createPasswordResetToken: (data: { userId: string; tokenHash: string; expiresAt: Date }) =>
    prisma.passwordResetToken.create({ data }),
  findPasswordResetToken: (tokenHash: string) =>
    prisma.passwordResetToken.findUnique({ where: { tokenHash } }),
  markPasswordResetUsed: (id: string) =>
    prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } }),
  // Email verification tokens
  createVerificationToken: (data: { userId: string; tokenHash: string; expiresAt: Date }) =>
    prisma.emailVerificationToken.create({ data }),
  findVerificationToken: (tokenHash: string) =>
    prisma.emailVerificationToken.findUnique({ where: { tokenHash } }),
  markVerificationUsed: (id: string) =>
    prisma.emailVerificationToken.update({ where: { id }, data: { usedAt: new Date() } }),
  listSessions: (userId: string, skip: number, take: number) =>
    prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true, revokedAt: true },
    }),
  countSessions: (userId: string) => prisma.session.count({ where: { userId } }),
  setActive: (userId: string, hospitalId: string, isActive: boolean) =>
    prisma.user.updateMany({ where: { id: userId, hospitalId }, data: { isActive } }),
  loginHistory: (userId: string, skip: number, take: number) =>
    prisma.loginEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take }),
  countLoginEvents: (userId: string) => prisma.loginEvent.count({ where: { userId } })
};
