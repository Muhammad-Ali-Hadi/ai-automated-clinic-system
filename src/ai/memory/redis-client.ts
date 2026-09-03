/**
 * @module ai/memory/redis-client
 * @description Redis client factory for conversation memory and response caching.
 *
 * If a real Redis server is not reachable, this transparently falls back to an
 * in-process store implementing the small subset of the Redis API the AI layer
 * uses (`get`, `set`, `setEx`, `del`). Conversation memory then works for the
 * lifetime of the process without an external dependency. Set `REDIS_URL` to a
 * running server for shared/persistent memory.
 */

import { createClient, type RedisClientType } from 'redis';
import { aiEnv } from '../config/ai-env.js';
import { logger } from '../../lib/logger.js';

type MinimalRedis = Pick<
  RedisClientType,
  'get' | 'set' | 'setEx' | 'del' | 'isReady' | 'isOpen' | 'connect' | 'disconnect' | 'quit' | 'on'
>;

let _client: MinimalRedis | null = null;
let _mode: 'redis' | 'memory' | null = null;

/** Minimal in-memory stand-in for the Redis commands the AI layer calls. */
function createMemoryClient(): MinimalRedis {
  const store = new Map<string, { value: string; expiresAt: number | null }>();

  const isAlive = (entry: { expiresAt: number | null }) =>
    entry.expiresAt === null || entry.expiresAt > Date.now();

  const api = {
    isReady: true,
    isOpen: true,
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (!isAlive(entry)) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string) {
      store.set(key, { value: String(value), expiresAt: null });
      return 'OK';
    },
    async setEx(key: string, seconds: number, value: string) {
      store.set(key, { value: String(value), expiresAt: Date.now() + seconds * 1000 });
      return 'OK';
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0;
    },
    async connect() {
      return api as unknown as RedisClientType;
    },
    async disconnect() {
      store.clear();
    },
    async quit() {
      store.clear();
      return 'OK';
    },
    on() {
      return api;
    },
  };
  return api as unknown as MinimalRedis;
}

export async function getRedisClient(): Promise<MinimalRedis> {
  if (_client && _client.isReady) return _client;

  if (_mode === 'memory') {
    _client = _client ?? createMemoryClient();
    return _client;
  }

  try {
    const real = createClient({
      url: aiEnv.REDIS_URL,
      socket: { reconnectStrategy: (retries) => (retries > 2 ? false : 200), connectTimeout: 1500 },
    }) as RedisClientType;

    real.on('error', (err: Error) => {
      // A single warn on first failure is enough; avoid log spam on reconnect storms.
      if (_mode !== 'memory') logger.warn({ err: err.message }, '[Redis] Client error');
    });

    await real.connect();
    _client = real;
    _mode = 'redis';
    logger.info('[Redis] Connected');
    return _client;
  } catch (err) {
    _mode = 'memory';
    _client = createMemoryClient();
    logger.warn(
      { err: (err as Error).message },
      '[Redis] Unavailable — using in-process memory store for AI conversation memory',
    );
    return _client;
  }
}

/** 'redis' once connected to a server, 'memory' when using the in-process fallback. */
export function getRedisMode(): 'redis' | 'memory' | 'unknown' {
  return _mode ?? 'unknown';
}

export async function disconnectRedis(): Promise<void> {
  if (_client && (_client.isReady || _client.isOpen)) {
    await _client.disconnect().catch(() => undefined);
    _client = null;
    _mode = null;
    logger.info('[Redis] Disconnected');
  }
}
