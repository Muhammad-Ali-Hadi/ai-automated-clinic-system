import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';

function ok(res: Response, data: unknown, message = 'OK', status = 200, meta?: unknown): void {
  res.status(status).json({ success: true, message, data, ...(meta ? { meta } : {}) });
}

export const login = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.login(req.body);
  res.status(200).json({ success: true, message: 'Login successful.', data: result });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.refresh(req.body.refreshToken);
  res.status(200).json({ success: true, message: 'Tokens refreshed.', data: result });
};

export const profile = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.profile(req.auth!.userId);
  res.status(200).json({ success: true, message: 'Profile retrieved.', data: result });
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  await authService.changePassword(req.auth!.userId, req.body.currentPassword, req.body.newPassword);
  res.status(200).json({ success: true, message: 'Password changed. All sessions revoked.' });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  await authService.logout(req.auth!, req.auth!.sessionId);
  res.status(200).json({ success: true, message: 'Logged out.' });
};

export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  await authService.logoutAll(req.auth!);
  res.status(200).json({ success: true, message: 'All sessions revoked.' });
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.updateProfile(req.auth!.userId, req.body);
  res.status(200).json({ success: true, message: 'Profile updated.', data: result });
};

export const deactivate = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.deactivate(req.auth!, String(req.params.userId));
  res.status(200).json({ success: true, message: 'Account deactivated.', data: result });
};

export const sessions = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.sessions(req.auth!.userId, { page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20) });
  ok(res, result.data, 'Sessions retrieved.', 200, result.meta);
};

export const loginHistory = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.loginHistory(req.auth!.userId, { page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20) });
  ok(res, result.data, 'Login history retrieved.', 200, result.meta);
};

export const registerHospital = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.registerHospital(req.body);
  res.status(201).json({ success: true, message: 'Hospital registered. Admin account created.', data: result });
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.createUser(req.auth!, req.body);
  res.status(201).json({ success: true, message: 'User created.', data: result });
};

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.listUsers(req.auth!, { page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20), search: (req.query.search as string) || undefined });
  ok(res, result.data, 'Users.', 200, result.meta);
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.updateUserRole(req.auth!, String(req.params.userId), (req.body as any).role);
  ok(res, result, 'User role updated. All sessions for the user have been revoked.');
};

export const roles = async (_req: Request, res: Response): Promise<void> => {
  ok(res, authService.roleCatalog(), 'Role catalogue.');
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.forgotPassword(req.body.email, req.ip);
  ok(res, result);
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.resetPassword(req.body.token, req.body.password, req.ip);
  ok(res, result);
};

export const requestEmailVerification = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.requestEmailVerification(req.auth!.userId);
  ok(res, result);
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const token = String((req.query.token as string) ?? (req.body && req.body.token) ?? '');
  const result = await authService.verifyEmail(token);
  ok(res, result);
};
