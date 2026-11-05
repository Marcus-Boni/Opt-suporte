/** Apaga TODO o schema (dados e anexos, que vivem no banco). Só em banco local ou com CONFIRM_DATABASE. */
import { pool } from './index.js';
import { env } from '../env.js';
import { assertDisposableDatabase, describeDatabase } from './connection.js';

if (env.NODE_ENV === 'production') throw new Error('db:reset é proibido com NODE_ENV=production.');
assertDisposableDatabase(env.DATABASE_URL, 'db:reset');
await pool.query('drop schema public cascade; create schema public; drop schema if exists drizzle cascade;');
console.log(`Banco ${describeDatabase(env.DATABASE_URL)} limpo.`);
await pool.end();
