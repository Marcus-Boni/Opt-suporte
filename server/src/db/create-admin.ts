/**
 * Cria o primeiro administrador Optsolv num banco novo (o seed de demonstração não roda em banco real).
 *
 *   pnpm --filter server db:create-admin -- --email pessoa@optsolv.com.br --name "Nome Sobrenome"
 *
 * A senha vem de ADMIN_PASSWORD (12+ caracteres) ou é gerada aqui e mostrada uma única vez.
 * Recusa se o e-mail já existir: o script não sobrescreve ninguém.
 */
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from './index.js';
import { env } from '../env.js';
import { describeDatabase } from './connection.js';
import { hashPassword, randomToken } from '../auth/password.js';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
  console.error('Uso: pnpm --filter server db:create-admin -- --email pessoa@empresa.com --name "Nome Sobrenome"');
  process.exit(1);
}
const fromEnv = process.env.ADMIN_PASSWORD;
if (fromEnv !== undefined && fromEnv.length < 12) {
  console.error('ADMIN_PASSWORD precisa de pelo menos 12 caracteres.');
  process.exit(1);
}

try {
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (exists) throw new Error(`Já existe um usuário com ${email}. Nada foi alterado.`);
  const password = fromEnv ?? randomToken(18);
  const [user] = await db.insert(schema.users).values({ email, name, role: 'admin_optsolv', passwordHash: await hashPassword(password) }).returning({ id: schema.users.id });
  await db.insert(schema.auditLogs).values({ actorLabel: 'db:create-admin', actorKind: 'system', action: 'user.create', entityType: 'user', entityId: user.id, meta: { email, role: 'admin_optsolv' } });
  console.log(`Administrador criado em ${describeDatabase(env.DATABASE_URL)}: ${name} <${email}>`);
  if (!fromEnv) console.log(`Senha gerada (aparece só agora; guarde num cofre e troque no primeiro acesso):\n  ${password}`);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
