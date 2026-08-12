import crypto from 'node:crypto';

/**
 * S3-compatible (Signature Version 4) pre-signed URL generator.
 *
 * No external SDK is required — this implements the official AWS SigV4
 * query-string signing algorithm using Node's built-in crypto, so it works with
 * AWS S3, Supabase Storage (S3 mode), MinIO, Cloudflare R2 and any other
 * S3-compatible object store.
 *
 * Returns null when storage credentials are not configured so callers can fall
 * back to a clearly-flagged placeholder.
 */
export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string; // custom endpoint (e.g. Supabase/MinIO/R2); defaults to AWS
  accessKeyId: string;
  secretAccessKey: string;
  expiresSeconds?: number; // default 900 (15 min)
}

const sha256Hex = (data: string | Buffer): string =>
  crypto.createHash('sha256').update(data).digest('hex');

const hmac = (key: Buffer | string, data: string): Buffer =>
  crypto.createHmac('sha256', key).update(data).digest();

const uriEncode = (str: string, encodeSlash = true): string =>
  str
    .split('')
    .map((ch) => {
      if (/[A-Za-z0-9\-._~]/.test(ch)) return ch;
      if (ch === '/' && !encodeSlash) return ch;
      return encodeURIComponent(ch);
    })
    .join('');

const buildCredentialScope = (dateStamp: string, region: string): string =>
  `${dateStamp}/${region}/s3/aws4_request`;

const getSigningKey = (secret: string, dateStamp: string, region: string): Buffer => {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
};

const toAmzDate = (d: Date): { amzDate: string; dateStamp: string } => {
  const iso = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
};

const hostFromConfig = (cfg: S3Config): { host: string; baseUrl: string } => {
  if (cfg.endpoint) {
    const url = new URL(cfg.endpoint);
    return { host: url.host, baseUrl: `${url.protocol}//${url.host}/${cfg.bucket}` };
  }
  const host = `${cfg.bucket}.s3.${cfg.region}.amazonaws.com`;
  return { host, baseUrl: `https://${host}` };
};

/**
 * Generate a pre-signed URL for the given HTTP method and object key.
 * method: 'PUT' for upload, 'GET' for download/delete.
 */
export const presignS3Url = (
  cfg: S3Config,
  method: 'PUT' | 'GET' | 'DELETE',
  storageKey: string,
  contentType?: string
): string => {
  const { host, baseUrl } = hostFromConfig(cfg);
  const { amzDate, dateStamp } = toAmzDate(new Date());
  const scope = buildCredentialScope(dateStamp, cfg.region);
  const expires = Math.min(Math.max(cfg.expiresSeconds ?? 900, 1), 604800); // <= 7 days

  const canonicalUri = `/${uriEncode(storageKey, false)}`;

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': contentType ? 'content-type;host' : 'host',
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k]!)}`)
    .join('&');

  const headers = contentType ? `content-type:${contentType}\nhost:${host}\n` : `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    headers,
    contentType ? 'content-type;host' : 'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = crypto
    .createHmac('sha256', getSigningKey(cfg.secretAccessKey, dateStamp, cfg.region))
    .update(stringToSign)
    .digest('hex');

  return `${baseUrl}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
};
