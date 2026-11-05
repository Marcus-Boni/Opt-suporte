/** Banco de testes separado (optsolv_experience_test): recriado, migrado e semeado a cada execução. */
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { assertDisposableDatabase, poolConfig } from '../src/db/connection.js';

export const BASE_URL = process.env.DATABASE_URL_BASE ?? 'postgres://optsolv:optsolv@127.0.0.1:5434/optsolv_experience';
export const TEST_URL = BASE_URL.replace(/\/[^/?]+(\?|$)/, '/optsolv_experience_test$1');

export default async function setup() {
  // O setup apaga o schema inteiro: só roda em banco local (ou remoto descartável confirmado).
  assertDisposableDatabase(TEST_URL, 'Suíte de testes');
  const admin = new pg.Client(poolConfig(BASE_URL));
  await admin.connect();
  const { rows } = await admin.query("select 1 from pg_database where datname = 'optsolv_experience_test'");
  if (!rows.length) await admin.query('create database optsolv_experience_test');
  await admin.end();

  process.env.DATABASE_URL = TEST_URL;
  const { db, pool } = await import('../src/db/index.js');
  await pool.query('drop schema public cascade; create schema public; drop schema if exists drizzle cascade;');
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  const { runSeed } = await import('../src/db/seed.js');
  await runSeed(() => {});
  await pool.end();
}
