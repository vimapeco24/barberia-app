import { createClient, RedisClientType } from 'redis';

const useMock = process.env.USE_MOCK_DB === 'true';

export type RedisClient = RedisClientType;

let redisClient: any;

if (useMock) {
  const { mockRedisClient } = require('./mock-database');
  redisClient = mockRedisClient;
} else {
  const { env } = require('./env');

  const redisUrl = env.REDIS_PASSWORD
    ? `redis://:${env.REDIS_PASSWORD}@${env.REDIS_HOST}:${env.REDIS_PORT}`
    : `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`;

  redisClient = createClient({ url: redisUrl });

  redisClient.on('error', (err: Error) => {
    console.error('Redis client error:', err);
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });
}

export { redisClient };

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectRedisWithRetry(): Promise<void> {
  if (useMock) {
    console.log('✅ Using mock Redis (in-memory)');
    return;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await redisClient.connect();
      return;
    } catch (error) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.error(
        `❌ Redis connection attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${delay}ms...`,
        error instanceof Error ? error.message : error
      );

      if (attempt === MAX_RETRIES) {
        throw new Error(`Failed to connect to Redis after ${MAX_RETRIES} attempts`);
      }

      await sleep(delay);
    }
  }
}

export async function disconnectRedis(): Promise<void> {
  await redisClient.quit();
  console.log('Redis connection closed');
}
