import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { app } from '../app.js';

describe('critical HTTP runtime surfaces', () => {
  it('serves health and Swagger without exposing implementation details', async () => {
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind');
    try {
      const base = `http://127.0.0.1:${address.port}`;
      const health = await fetch(`${base}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual(expect.objectContaining({ success: true, data: { status: 'ok' } }));
      const docs = await fetch(`${base}/api-docs/`);
      expect(docs.status).toBe(200);
      expect(await docs.text()).toContain('swagger');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
