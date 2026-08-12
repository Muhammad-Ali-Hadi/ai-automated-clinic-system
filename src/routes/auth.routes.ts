import { Router } from 'express'; import { z } from 'zod'; import { login, logout, logoutAll, refresh, profile, updateProfile, changePassword, sessions, loginHistory, registerHospital, createUser, listUsers, updateUserRole, roles, forgotPassword, resetPassword, requestEmailVerification, verifyEmail } from '../controllers/auth.controller.js'; import { authenticate, authorize, requireTenant } from '../middlewares/auth.js'; import { validate } from '../middlewares/validate.js';
export const authRouter = Router(); const loginSchema = z.object({ body: z.object({ email: z.string().email(), password: z.string().min(8) }), query: z.object({}), params: z.object({}) }); const refreshSchema = z.object({ body: z.object({ refreshToken: z.string().min(1) }), query: z.object({}), params: z.object({}) }); authRouter.post('/login', validate(loginSchema), login); authRouter.post('/refresh', validate(refreshSchema), refresh); authRouter.post('/logout', authenticate, logout); authRouter.post('/logout-all', authenticate, logoutAll);

authRouter.get('/profile', authenticate, profile); authRouter.patch('/profile', authenticate, validate(z.object({ body: z.object({ firstName: z.string().min(1).max(100).optional(), lastName: z.string().min(1).max(100).optional() }), query: z.object({}), params: z.object({}) })), updateProfile); authRouter.post('/change-password', authenticate, validate(z.object({ body: z.object({ currentPassword: z.string().min(8), newPassword: z.string().min(8) }), query: z.object({}), params: z.object({}) })), changePassword);
const pageQuery = z.object({ body: z.object({}), query: z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }), params: z.object({}) });
authRouter.get('/sessions', authenticate, validate(pageQuery), sessions);
authRouter.get('/login-history', authenticate, validate(pageQuery), loginHistory);
const ROLE_ENUM = z.enum(['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'PHARMACIST', 'LABORATORY_TECHNICIAN', 'ACCOUNTANT', 'PATIENT']);
const passwordField = z.string().min(8).max(128);

// Public: hospital registration (creates hospital + HOSPITAL_ADMIN + settings)
authRouter.post('/register', validate(z.object({ body: z.object({ hospitalName: z.string().min(2).max(200), email: z.string().email(), password: passwordField, firstName: z.string().min(1).max(100), lastName: z.string().min(1).max(100) }), query: z.object({}), params: z.object({}) })), registerHospital);

// Public: forgot / reset password
authRouter.post('/forgot-password', validate(z.object({ body: z.object({ email: z.string().email() }), query: z.object({}), params: z.object({}) })), forgotPassword);
authRouter.post('/reset-password', validate(z.object({ body: z.object({ token: z.string().min(1), password: passwordField }), query: z.object({}), params: z.object({}) })), resetPassword);

// Public: email verification (token via query or body)
authRouter.get('/verify-email', validate(z.object({ body: z.object({}).passthrough(), query: z.object({ token: z.string().min(1) }), params: z.object({}) })), verifyEmail);
authRouter.post('/verify-email', validate(z.object({ body: z.object({ token: z.string().min(1) }), query: z.object({}), params: z.object({}) })), verifyEmail);
authRouter.post('/verify-email/request', authenticate, requestEmailVerification);

// Authenticated: role catalogue
authRouter.get('/roles', authenticate, requireTenant, roles);

// Admin: user management + role management
const adminOnly = [authenticate, requireTenant, authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN')] as const;
authRouter.post('/users', ...adminOnly, validate(z.object({ body: z.object({ email: z.string().email(), password: passwordField, firstName: z.string().min(1).max(100), lastName: z.string().min(1).max(100), role: ROLE_ENUM }), query: z.object({}), params: z.object({}) })), createUser);
authRouter.get('/users', ...adminOnly, validate(z.object({ body: z.object({}), query: z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().max(100).optional() }), params: z.object({}) })), listUsers);
authRouter.patch('/users/:userId/role', ...adminOnly, validate(z.object({ body: z.object({ role: ROLE_ENUM }), query: z.object({}), params: z.object({ userId: z.string().uuid() }) })), updateUserRole);
