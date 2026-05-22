import { Pool, PoolConfig } from 'pg';

const useMock = process.env.USE_MOCK_DB === 'true';

let pool: any;

if (useMock) {
  // Lazy import to avoid circular deps
  const { mockPool } = require('./mock-database');
  pool = mockPool;
} else {
  const { env } = require('./env');

  const poolConfig: PoolConfig = {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    max: env.DB_MAX_CONNECTIONS,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  pool = new Pool(poolConfig);

  pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle database client', err);
  });
}

export { pool };

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectWithRetry(): Promise<void> {
  if (useMock) {
    console.log('✅ Using mock database (in-memory)');
    return;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log('✅ PostgreSQL connected successfully');
      return;
    } catch (error) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.error(
        `❌ PostgreSQL connection attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${delay}ms...`,
        error instanceof Error ? error.message : error
      );

      if (attempt === MAX_RETRIES) {
        throw new Error(`Failed to connect to PostgreSQL after ${MAX_RETRIES} attempts`);
      }

      await sleep(delay);
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await pool.end();
  console.log('PostgreSQL pool closed');
}
