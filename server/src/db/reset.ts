import { rmSync } from 'node:fs';
import { pool } from './index.js';
import { env } from '../env.js';

await pool.query('drop schema public cascade; create schema public; drop schema if exists drizzle cascade;');
rmSync(env.UPLOAD_DIR, { recursive: true, force: true });
console.log('Banco e anexos limpos.');
await pool.end();
