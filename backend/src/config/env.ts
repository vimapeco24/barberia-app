import { z } from 'zod';

const useMock = process.env.USE_MOCK_DB === 'true';

const envSchema = useMock
  ? z.object({
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      PORT: z.coerce.number().default(3000),
      USE_MOCK_DB: z.string().optional(),
      DB_HOST: z.string().default('localhost'),
      DB_PORT: z.coerce.number().default(5432),
      DB_NAME: z.string().default('barbershop'),
      DB_USER: z.string().default('postgres'),
      DB_PASSWORD: z.string().default('postgres'),
      DB_MAX_CONNECTIONS: z.coerce.number().default(20),
      REDIS_HOST: z.string().default('localhost'),
      REDIS_PORT: z.coerce.number().default(6379),
      REDIS_PASSWORD: z.string().optional(),
      JWT_SECRET: z.string().default('dev-mock-jwt-secret-key'),
      JWT_REFRESH_SECRET: z.string().default('dev-mock-refresh-secret-key'),
      JWT_ACCESS_EXPIRATION: z.string().default('15m'),
      JWT_REFRESH_EXPIRATION: z.string().default('7d'),
    })
  : z.object({
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      PORT: z.coerce.number().default(3000),
      USE_MOCK_DB: z.string().optional(),
      DB_HOST: z.string().min(1),
      DB_PORT: z.coerce.number().default(5432),
      DB_NAME: z.string().min(1),
      DB_USER: z.string().min(1),
      DB_PASSWORD: z.string().min(1),
      DB_MAX_CONNECTIONS: z.coerce.number().default(20),
      REDIS_HOST: z.string().default('localhost'),
      REDIS_PORT: z.coerce.number().default(6379),
      REDIS_PASSWORD: z.string().optional(),
      JWT_SECRET: z.string().min(1),
      JWT_REFRESH_SECRET: z.string().min(1),
      JWT_ACCESS_EXPIRATION: z.string().default('15m'),
      JWT_REFRESH_EXPIRATION: z.string().default('7d'),
    });

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const missing = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, value]) => `  ${key}: ${(value as { _errors: string[] })._errors.join(', ')}`)
      .join('\n');

    throw new Error(`❌ Invalid environment variables:\n${missing}`);
  }

  return result.data;
}

export const env = validateEnv();
