import pino, { type DestinationStream, type Logger } from 'pino';
import { env } from '../config/env.js';

export const redactPaths = [
  'req.headers.authorization', 'req.headers.cookie', 'req.headers.set-cookie',
  'password', 'passwordHash', 'currentPassword', 'newPassword',
  'accessToken', 'refreshToken', 'resetToken', 'verificationToken',
  'token', 'secret', 'apiKey', 'authorization',
  '*.password', '*.passwordHash', '*.currentPassword', '*.newPassword',
  '*.accessToken', '*.refreshToken', '*.resetToken', '*.verificationToken',
  '*.token', '*.secret', '*.apiKey', '*.authorization',
  'DATABASE_URL', 'DIRECT_URL', 'AWS_SECRET_ACCESS_KEY', 'SMTP_PASS',
];

export const createLogger = (destination?: DestinationStream): Logger => pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: '[REDACTED]' },
}, destination);

export const logger = createLogger();
