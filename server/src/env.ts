import 'dotenv/config';

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://optsolv:optsolv@127.0.0.1:5434/optsolv_experience',
  PORT: Number(process.env.PORT ?? 4000),
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'segredo-local-inseguro',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};

if (env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) {
  throw new Error('Defina SESSION_SECRET (32+ caracteres) para rodar em produção.');
}
