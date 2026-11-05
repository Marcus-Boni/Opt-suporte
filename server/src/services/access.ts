import { asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { assertAdmin, type Actor, type Role } from '../auth/actor.js';
import { hashPassword, randomToken, sha256 } from '../auth/password.js';
import { badRequest, notFound } from '../lib/errors.js';
import { audit } from './audit.js';

export async function listUsers(actor: Actor) {
  assertAdmin(actor);
  const users = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role, clientId: schema.users.clientId, isActive: schema.users.isActive, createdAt: schema.users.createdAt, microsoft: sql<boolean>`${isNotNull(schema.users.entraOid)}` })
    .from(schema.users).orderBy(asc(schema.users.role), asc(schema.users.name));
  const memberships = await db.select().from(schema.memberships);
  return users.map((u) => ({ ...u, clientIds: u.role === 'cliente' ? (u.clientId ? [u.clientId] : []) : memberships.filter((m) => m.userId === u.id).map((m) => m.clientId) }));
}

export async function createUser(actor: Actor, input: { name: string; email: string; password: string; role: Role; clientId?: string; clientIds?: string[] }) {
  assertAdmin(actor);
  const email = input.email.toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('E-mail inválido.');
  if (input.password.length < 8) throw badRequest('A senha precisa ter ao menos 8 caracteres.');
  if (input.role === 'cliente' && !input.clientId) throw badRequest('Usuário de cliente precisa de um cliente.');
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (exists) throw badRequest('Já existe um usuário com este e-mail.');
  const [user] = await db.insert(schema.users).values({
    name: input.name.trim(), email, passwordHash: await hashPassword(input.password), role: input.role, clientId: input.role === 'cliente' ? input.clientId : null,
  }).returning();
  if (input.role === 'colaborador_optsolv' && input.clientIds?.length) {
    await db.insert(schema.memberships).values(input.clientIds.map((clientId) => ({ userId: user.id, clientId })));
  }
  await audit(actor, 'user.create', 'user', user.id, user.clientId, { role: user.role });
  return { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId };
}

export async function setUserActive(actor: Actor, id: string, isActive: boolean) {
  assertAdmin(actor);
  if (id === actor.id) throw badRequest('Você não pode desativar a si mesmo.');
  const [user] = await db.update(schema.users).set({ isActive }).where(eq(schema.users.id, id)).returning();
  if (!user) throw notFound('Usuário');
  if (!isActive) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
  await audit(actor, isActive ? 'user.activate' : 'user.deactivate', 'user', id, user.clientId);
  return { id: user.id, isActive: user.isActive };
}

/** Admin muda o papel de alguém da equipe (colaborador ↔ admin) e os clientes que um colaborador enxerga. */
export async function updateUserAccess(actor: Actor, id: string, input: { role?: 'admin_optsolv' | 'colaborador_optsolv'; clientIds?: string[] }) {
  assertAdmin(actor);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!user) throw notFound('Usuário');
  if (user.role === 'cliente') throw badRequest('Usuários de cliente não mudam de papel; crie um novo acesso.');
  if (id === actor.id && input.role && input.role !== 'admin_optsolv') throw badRequest('Você não pode tirar o próprio papel de administrador.');
  const clientIds = [...new Set(input.clientIds ?? [])];
  if (clientIds.length) {
    const found = await db.select({ id: schema.clients.id }).from(schema.clients).where(inArray(schema.clients.id, clientIds));
    if (found.length !== clientIds.length) throw badRequest('Algum cliente informado não existe.');
  }
  await db.transaction(async (tx) => {
    if (input.role) await tx.update(schema.users).set({ role: input.role }).where(eq(schema.users.id, id));
    if (input.clientIds) {
      await tx.delete(schema.memberships).where(eq(schema.memberships.userId, id));
      if (clientIds.length) await tx.insert(schema.memberships).values(clientIds.map((clientId) => ({ userId: id, clientId })));
    }
  });
  await audit(actor, 'user.access', 'user', id, null, { from: user.role, role: input.role ?? user.role, clients: input.clientIds ? clientIds.length : undefined });
  return { id, role: input.role ?? user.role };
}

export async function listCredentials(actor: Actor) {
  assertAdmin(actor);
  return db.select({ id: schema.apiCredentials.id, name: schema.apiCredentials.name, prefix: schema.apiCredentials.prefix, role: schema.apiCredentials.role, clientId: schema.apiCredentials.clientId, clientName: schema.clients.name, lastUsedAt: schema.apiCredentials.lastUsedAt, revokedAt: schema.apiCredentials.revokedAt, createdAt: schema.apiCredentials.createdAt })
    .from(schema.apiCredentials).leftJoin(schema.clients, eq(schema.clients.id, schema.apiCredentials.clientId))
    .orderBy(desc(schema.apiCredentials.createdAt));
}

/** Gera o token em texto claro uma única vez; o banco guarda apenas o hash. */
export async function createCredential(actor: Actor, input: { name: string; role: Role; clientId?: string; token?: string }) {
  assertAdmin(actor);
  if (input.role !== 'admin_optsolv' && !input.clientId) throw badRequest('Credenciais não-admin precisam de um cliente de escopo.');
  const token = input.token ?? `osk_${randomToken(24)}`;
  const prefix = token.slice(0, 12);
  const [cred] = await db.insert(schema.apiCredentials).values({
    name: input.name.trim(), prefix, tokenHash: sha256(token), role: input.role, clientId: input.role === 'admin_optsolv' ? null : input.clientId, createdBy: actor.userId,
  }).returning();
  await audit(actor, 'credential.create', 'api_credential', cred.id, cred.clientId, { role: cred.role });
  return { id: cred.id, name: cred.name, prefix, role: cred.role, clientId: cred.clientId, token };
}

export async function revokeCredential(actor: Actor, id: string) {
  assertAdmin(actor);
  const [cred] = await db.update(schema.apiCredentials).set({ revokedAt: new Date() }).where(eq(schema.apiCredentials.id, id)).returning();
  if (!cred) throw notFound('Credencial');
  await audit(actor, 'credential.revoke', 'api_credential', id, cred.clientId);
  return { id: cred.id, revokedAt: cred.revokedAt };
}

export async function listAudit(actor: Actor, limit = 50) {
  assertAdmin(actor);
  return db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(Math.min(200, limit));
}
