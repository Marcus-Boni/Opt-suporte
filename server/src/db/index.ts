import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.js';
import { poolConfig } from './connection.js';
import * as schema from './schema.js';

export const pool = new pg.Pool(poolConfig(env.DATABASE_URL));
// O Azure encerra conexões ociosas; sem este handler o erro de um cliente parado derrubaria o processo.
pool.on('error', (err) => console.error('[db] conexão ociosa encerrada pelo servidor:', err.message));

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export { schema };
export type { Slide, SlideRef } from './schema.js';
