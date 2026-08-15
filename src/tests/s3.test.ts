import { describe, expect, it } from 'vitest';
import { presignS3Url } from '../lib/s3.js';

describe('S3-compatible presigning', () => {
  it('preserves a custom endpoint path such as Supabase Storage S3', () => {
    const url = new URL(presignS3Url({
      endpoint: 'https://project.storage.supabase.co/storage/v1/s3',
      bucket: 'hospital-files',
      region: 'ap-northeast-2',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    }, 'PUT', 'hospitals/h1/files/check.txt'));

    expect(url.pathname).toBe('/storage/v1/s3/hospital-files/hospitals/h1/files/check.txt');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
  });
});
