import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { Role } from '@prisma/client';
import { addDays } from '../utils/date.js';
import { AppError } from '../utils/app-error.js';
import { hashToken } from '../utils/crypto.js';
import { userRepository } from '../repositories/user.repository.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './token.service.js';
import { mailer } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';

type LoginInput = { email: string; password: string; userAgent?: string; ipAddress?: string };
const claims = (user: { id: string; hospitalId: string | null; role: Role }, sessionId: string) => ({ sub: user.id, hospitalId: user.hospitalId, role: user.role, sessionId });
const createTokens = async (user: { id: string; hospitalId: string | null; role: Role }, metadata: { userAgent?: string; ipAddress?: string } = {}) => {
  const session = await userRepository.createSession({ userId: user.id, tokenHash: hashToken(crypto.randomUUID()), expiresAt: addDays(new Date(), 30), ...metadata });
  const refreshToken = signRefreshToken(claims(user, session.id));
  await userRepository.updateSessionToken(session.id, hashToken(refreshToken));
  return { accessToken: signAccessToken(claims(user, session.id)), refreshToken };
};
export const authService = {
  async login(input: LoginInput) {
    const user = await userRepository.findByEmail(input.email.toLowerCase());
    const valid = !!user && user.isActive && await bcrypt.compare(input.password, user.passwordHash);
    await userRepository.loginEvent({ userId: valid ? user!.id : undefined, email: input.email.toLowerCase(), success: valid, ipAddress: input.ipAddress });
    const { auditService: audit } = await import('./audit.service.js');
    if (!valid) {
      if (user) await audit.record({ userId: user.id, hospitalId: user.hospitalId }, 'LOGIN_FAILED', 'User', user.id, { ipAddress: input.ipAddress });
      throw new AppError('Invalid email or password.', 401);
    }
    const tokens = await createTokens(user!, { userAgent: input.userAgent, ipAddress: input.ipAddress });
    await audit.record({ userId: user!.id, hospitalId: user!.hospitalId }, 'LOGIN', 'User', user!.id, { ipAddress: input.ipAddress });
    return { ...tokens, user: { id: user!.id, email: user!.email, role: user!.role, hospitalId: user!.hospitalId } };
  },
  async refresh(refreshToken: string) {
    const tokenClaims = verifyRefreshToken(refreshToken);
    const session = await userRepository.session(tokenClaims.sessionId);
    if (!session || session.revokedAt || session.tokenHash !== hashToken(refreshToken) || session.expiresAt < new Date()) throw new AppError('Invalid refresh token.', 401);
    const user = await userRepository.findById(tokenClaims.sub);
    if (!user || !user.isActive) throw new AppError('Invalid refresh token.', 401);
    await userRepository.revokeSession(session.id);
    const tokens = await createTokens(user);
    const { auditService: audit } = await import('./audit.service.js');
    await audit.record({ userId: user.id, hospitalId: user.hospitalId }, 'REFRESH', 'Session', session.id);
    return tokens;
  },
  async profile(userId: string) { const user = await userRepository.findById(userId); if (!user) throw new AppError('User not found.', 404); return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, hospitalId: user.hospitalId, createdAt: user.createdAt }; },
  async updateProfile(userId: string, input: { firstName?: string; lastName?: string }) { const user = await userRepository.updateProfile(userId, input); return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, hospitalId: user.hospitalId }; },
  async changePassword(userId: string, currentPassword: string, nextPassword: string) { const user = await userRepository.findById(userId); if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError('Current password is invalid.', 400); await userRepository.updatePassword(userId, await bcrypt.hash(nextPassword, 12)); await userRepository.revokeAll(userId); const { auditService: audit } = await import('./audit.service.js'); await audit.record({ userId: user.id, hospitalId: user.hospitalId }, 'PASSWORD_CHANGE', 'User', user.id); },
  async logout(auth: { userId: string; hospitalId: string | null }, sessionId: string) { await userRepository.revokeSession(sessionId); const { auditService: audit } = await import('./audit.service.js'); await audit.record(auth, 'LOGOUT', 'Session', sessionId); },
  async logoutAll(auth: { userId: string; hospitalId: string | null }) { await userRepository.revokeAll(auth.userId); const { auditService: audit } = await import('./audit.service.js'); await audit.record(auth, 'LOGOUT_ALL', 'User', auth.userId); },
  async sessions(userId: string, query: { page?: number; limit?: number }) {
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      userRepository.listSessions(userId, (page - 1) * limit, limit),
      userRepository.countSessions(userId),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
  async loginHistory(userId: string, query: { page?: number; limit?: number }) {
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      userRepository.loginHistory(userId, (page - 1) * limit, limit),
      userRepository.countLoginEvents(userId),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async registerHospital(input: { hospitalName: string; email: string; password: string; firstName: string; lastName: string }) {
    const email = input.email.toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new AppError('A user with this email already exists.', 409);
    const slug = input.hospitalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `hospital-${Date.now()}`;
    const passwordHash = await bcrypt.hash(input.password, 12);
    const { prisma } = await import('../lib/prisma.js');
    const result = await prisma.$transaction(async (tx) => {
      const hospital = await tx.hospital.create({ data: { name: input.hospitalName, slug } });
      await tx.hospitalSettings.create({ data: { hospitalId: hospital.id, preferences: {}, configuration: {} } });
      const user = await tx.user.create({ data: { hospitalId: hospital.id, email, passwordHash, firstName: input.firstName, lastName: input.lastName, role: 'HOSPITAL_ADMIN' } });
      return { hospital, user };
    });
    const { auditService: audit } = await import('./audit.service.js');
    await audit.record({ userId: result.user.id, hospitalId: result.hospital.id }, 'HOSPITAL_REGISTER', 'Hospital', result.hospital.id, { email });
    return { hospitalId: result.hospital.id, userId: result.user.id, email };
  },

  async createUser(auth: { userId: string; hospitalId: string | null; role: Role }, input: { email: string; password: string; firstName: string; lastName: string; role: Role }) {
    if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
    if (input.role === 'SUPER_ADMIN') throw new AppError('Cannot create a SUPER_ADMIN user via this endpoint.', 400);
    const email = input.email.toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new AppError('A user with this email already exists.', 409);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await userRepository.createUser({ email, passwordHash, firstName: input.firstName, lastName: input.lastName, role: input.role, hospitalId: auth.hospitalId });
    const { auditService: audit } = await import('./audit.service.js');
    await audit.record(auth, 'CREATE', 'User', user.id, { role: input.role });
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role };
  },

  async listUsers(auth: { hospitalId: string | null }, query: { page?: number; limit?: number; search?: string }) {
    if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([userRepository.listUsers(auth.hospitalId, (page - 1) * limit, limit, query.search), userRepository.countUsers(auth.hospitalId, query.search)]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async updateUserRole(auth: { userId: string; hospitalId: string | null; role: Role }, userId: string, role: Role) {
    if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
    if (role === 'SUPER_ADMIN') throw new AppError('Cannot assign the SUPER_ADMIN role.', 400);
    if (userId === auth.userId) throw new AppError('You cannot change your own role.', 400);
    const target = await userRepository.findByIdInTenant(userId, auth.hospitalId);
    if (!target) throw new AppError('User not found.', 404);
    await userRepository.updateRole(userId, auth.hospitalId, role);
    const { auditService: audit } = await import('./audit.service.js');
    await audit.record(auth, 'UPDATE_ROLE', 'User', userId, { from: target.role, to: role });
    await userRepository.revokeAll(userId);
    return { id: userId, role };
  },

  async forgotPassword(email: string, ipAddress?: string) {
    const normalised = email.toLowerCase();
    const user = await userRepository.findByEmail(normalised);
    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      if (!mailer.isConfigured()) {
        logger.warn({ userId: user.id }, 'Password reset requested while email delivery is unavailable');
        return { message: 'If an account with that email exists, a password reset link has been sent.' };
      }
      await mailer.send(user.email, 'Reset your Renovia password', `Use this password reset token within 24 hours: ${token}`);
      await userRepository.createPasswordResetToken({ userId: user.id, tokenHash: hashToken(token), expiresAt: addDays(new Date(), 1) });
      const { auditService: audit } = await import('./audit.service.js');
      await audit.record({ userId: user.id, hospitalId: user.hospitalId }, 'PASSWORD_RESET_REQUEST', 'User', user.id, { ipAddress });
    }
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  },

  async resetPassword(token: string, newPassword: string, ipAddress?: string) {
    const record = await userRepository.findPasswordResetToken(hashToken(token));
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new AppError('Invalid or expired password reset token.', 400);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userRepository.updatePassword(record.userId, passwordHash);
    await userRepository.markPasswordResetUsed(record.id);
    await userRepository.revokeAll(record.userId);
    const { auditService: audit } = await import('./audit.service.js');
    await audit.record({ userId: record.userId, hospitalId: null }, 'PASSWORD_RESET', 'User', record.userId, { ipAddress });
    return { message: 'Password has been reset successfully.' };
  },

  async requestEmailVerification(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found.', 404);
    if (user.emailVerifiedAt) throw new AppError('Email is already verified.', 400);
    if (!mailer.isConfigured()) throw new AppError('Email delivery is not configured.', 503);
    const token = crypto.randomBytes(32).toString('hex');
    await mailer.send(user.email, 'Verify your Renovia email address', `Use this verification token within 7 days: ${token}`);
    await userRepository.createVerificationToken({ userId, tokenHash: hashToken(token), expiresAt: addDays(new Date(), 7) });
    return { message: 'Verification email sent.' };
  },

  async verifyEmail(token: string) {
    const record = await userRepository.findVerificationToken(hashToken(token));
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new AppError('Invalid or expired verification token.', 400);
    await userRepository.setEmailVerified(record.userId);
    await userRepository.markVerificationUsed(record.id);
    const { auditService: audit } = await import('./audit.service.js');
    await audit.record({ userId: record.userId, hospitalId: null }, 'EMAIL_VERIFIED', 'User', record.userId);
    return { message: 'Email verified successfully.' };
  },

  async deactivate(auth: { userId: string; hospitalId: string | null; role: Role }, userId: string) {
    if (!auth.hospitalId) throw new AppError('Tenant context required.', 403);
    if (userId === auth.userId) throw new AppError('You cannot deactivate your own account.', 400);
    const target = await userRepository.findByIdInTenant(userId, auth.hospitalId);
    if (!target) throw new AppError('User not found.', 404);
    await userRepository.setActive(userId, auth.hospitalId, false);
    await userRepository.revokeAll(userId);
    const { auditService: audit } = await import('./audit.service.js');
    await audit.record(auth, 'DEACTIVATE', 'User', userId);
    return { id: userId, isActive: false };
  },
  roleCatalog() {
    return { roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'PHARMACIST', 'LABORATORY_TECHNICIAN', 'ACCOUNTANT', 'PATIENT'] };
  }
};
