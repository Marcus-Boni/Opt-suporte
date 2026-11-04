import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { unauthorized } from '../lib/errors.js';
import { randomToken, sha256, verifyPassword } from './password.js';
import type { Actor } from './actor.js';

const SESSION_DAYS = 7;

async function actorFromUser(user: typeof schema.users.$inferSelect): Promise<Actor> {
  let clientIds: Actor['clientIds'];
  if (user.role === 'admin_optsolv') clientIds = 'all';
  else if (user.role === 'cliente') clientIds = user.clientId ? [user.clientId] : [];
  else {
    const rows = await db.select({ clientId: schema.memberships.clientId })
      .from(schema.memberships).where(eq(schema.memberships.userId, user.id));
    clientIds = rows.map((r) => r.clientId);
  }
  return { kind: 'user', id: user.id, userId: user.id, label: user.name, role: user.role, clientIds };
}

export async function login(email: string, password: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim()));
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    throw unauthorized('E-mail ou senha inválidos.');
  }
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  const id = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ id, userId: user.id, expiresAt });
  return { sessionId: id, actor: await actorFromUser(user), user };
}

export async function logout(sessionId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export async function actorFromSession(sessionId: string): Promise<Actor | null> {
  const [row] = await db.select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sessionId), gt(schema.sessions.expiresAt, new Date())));
  if (!row || !row.user.isActive) return null;
  return actorFromUser(row.user);
}

export async function actorFromToken(token: string): Promise<Actor | null> {
  const [cred] = await db.select().from(schema.apiCredentials)
    .where(and(eq(schema.apiCredentials.tokenHash, sha256(token)), isNull(schema.apiCredentials.revokedAt)));
  if (!cred) return null;
  if (!cred.lastUsedAt || Date.now() - cred.lastUsedAt.getTime() > 60_000) {
    await db.update(schema.apiCredentials).set({ lastUsedAt: new Date() }).where(eq(schema.apiCredentials.id, cred.id));
  }
  const clientIds: Actor['clientIds'] = cred.clientId ? [cred.clientId] : cred.role === 'admin_optsolv' ? 'all' : [];
  return { kind: 'credential', id: cred.id, userId: cred.createdBy, label: `Agente: ${cred.name}`, role: cred.role, clientIds };
}

export async function userProfile(actor: Actor) {
  if (actor.kind !== 'user') return null;
  const [u] = await db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role, clientId: schema.users.clientId })
    .from(schema.users).where(eq(schema.users.id, actor.id));
  return u ?? null;
}
