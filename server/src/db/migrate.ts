/**
 * Aplica as migrações (server/drizzle). Usa DATABASE_MIGRATION_URL quando definida, para que o papel
 * da aplicação não precise de permissão de DDL. Um advisory lock impede dois deploys migrando ao mesmo tempo.
 */
import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { env } from '../env.js';
import { describeDatabase, poolConfig } from './connection.js';

const url = process.env.DATABASE_MIGRATION_URL || env.DATABASE_URL;
const client = new pg.Client(poolConfig(url, { statement_timeout: 0, application_name: 'optsolv-suporte-migrate' }));
await client.connect();
try {
  await client.query(`select pg_advisory_lock(hashtext('optsolv-suporte:migrations'))`);
  await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  console.log(`Migrações aplicadas em ${describeDatabase(url)}.`);
} finally {
  await client.query(`select pg_advisory_unlock(hashtext('optsolv-suporte:migrations'))`).catch(() => {});
  await client.end();
}
