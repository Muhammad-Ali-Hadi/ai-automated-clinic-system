/**
 * @module ai/memory/redis-client
 * @description Redis client factory for conversation memory and response caching.
 */

import { createClient, type RedisClientType } from 'redis';
import { aiEnv } from '../config/ai-env.js';
import { logger } from '../../lib/logger.js';

let _client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (_client && _client.isReady) return _client;

  _client = createClient({ url: aiEnv.REDIS_URL }) as RedisClientType;

  _client.on('error', (err: Error) => {
    logger.error({ err }, '[Redis] Client error');
  });

  _client.on('reconnecting', () => {
    logger.warn('[Redis] Reconnecting…');
  });

  await _client.connect();
  logger.info('[Redis] Connected');

  return _client;
}

export async function disconnectRedis(): Promise<void> {
  if (_client?.isReady) {
    await _client.disconnect();
    _client = null;
    logger.info('[Redis] Disconnected');
  }
}
