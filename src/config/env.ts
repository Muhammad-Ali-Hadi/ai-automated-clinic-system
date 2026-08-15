import { z } from 'zod';
import 'dotenv/config';

const optionalText = z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional());
const optionalUrl = z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional());
const booleanFromEnv = z.preprocess(
  (value) => value === 'true' ? true : value === 'false' ? false : value,
  z.boolean()
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('30d'),
  CORS_ORIGIN: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  SMTP_HOST: optionalText,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromEnv.default(false),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  SMTP_FROM: z.string().min(1).default('Renovia Hospital OS <no-reply@renovia.local>'),
  S3_BUCKET: optionalText,
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ENDPOINT: optionalUrl,
  AWS_ACCESS_KEY_ID: optionalText,
  AWS_SECRET_ACCESS_KEY: optionalText,
  JOB_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
  JOB_LOCK_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(86_400).default(300),
  JOB_MAX_BACKOFF_SECONDS: z.coerce.number().int().min(1).max(86_400).default(300),
}).superRefine((value, ctx) => {
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_REFRESH_SECRET'], message: 'must differ from JWT_ACCESS_SECRET' });
  }
  const smtp = [value.SMTP_HOST, value.SMTP_USER, value.SMTP_PASS];
  if (smtp.some(Boolean) && !smtp.every(Boolean)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SMTP_HOST'], message: 'SMTP_HOST, SMTP_USER and SMTP_PASS must be set together' });
  }
  const storage = [value.S3_BUCKET, value.AWS_ACCESS_KEY_ID, value.AWS_SECRET_ACCESS_KEY];
  if (storage.some(Boolean) && !storage.every(Boolean)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['S3_BUCKET'], message: 'S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set together' });
  }
  if (value.NODE_ENV === 'production' && !smtp.every(Boolean)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SMTP_HOST'], message: 'SMTP configuration is required in production' });
  }
});

export type AppEnv = z.infer<typeof schema>;
export const parseEnv = (input: NodeJS.ProcessEnv): AppEnv => schema.parse(input);
export const env: AppEnv = parseEnv(process.env);
export const corsOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
export const isMailerConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
export const isStorageConfigured = Boolean(env.S3_BUCKET && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
