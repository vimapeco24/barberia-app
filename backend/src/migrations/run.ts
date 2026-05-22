import { pool, connectWithRetry, disconnectDatabase } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.resolve(__dirname);

async function getMigrationFiles(): Promise<string[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR);
  return files
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const result = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((row) => row.filename));
}

async function runMigrations(): Promise<void> {
  console.log('🚀 Starting database migrations...');

  await connectWithRetry();
  await ensureMigrationsTable();

  const migrationFiles = await getMigrationFiles();
  const executedMigrations = await getExecutedMigrations();

  let migrationsRun = 0;

  for (const file of migrationFiles) {
    if (executedMigrations.has(file)) {
      console.log(`⏭️  Skipping already executed: ${file}`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`✅ Executed: ${file}`);
      migrationsRun++;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Failed to execute: ${file}`);
      console.error(error instanceof Error ? error.message : error);
      throw error;
    } finally {
      client.release();
    }
  }

  if (migrationsRun === 0) {
    console.log('✅ All migrations are up to date.');
  } else {
    console.log(`✅ Successfully ran ${migrationsRun} migration(s).`);
  }

  await disconnectDatabase();
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
