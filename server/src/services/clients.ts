import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { assertAdmin, assertClient, assertInternal, visibleClientIds, type Actor } from '../auth/actor.js';
import { badRequest, notFound } from '../lib/errors.js';
import { audit } from './audit.js';

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export async function listClients(actor: Actor) {
  const ids = visibleClientIds(actor);
  if (ids && ids.length === 0) return [];
  const rows = await db.select({
    id: schema.clients.id, slug: schema.clients.slug, shortCode: schema.clients.shortCode, name: schema.clients.name,
    segment: schema.clients.segment, description: schema.clients.description, createdAt: schema.clients.createdAt,
    projectCount: sql<number>`(select count(*)::int from ${schema.projects} p where p.client_id = ${schema.clients}.id and p.is_active)`,
    openRequests: sql<number>`(select count(*)::int from ${schema.requests} r where r.client_id = ${schema.clients}.id and r.status not in ('concluida','cancelada'))`,
    publishedDeliveries: sql<number>`(select count(*)::int from ${schema.deliveries} d where d.client_id = ${schema.clients}.id and d.status = 'publicada')`,
  }).from(schema.clients)
    .where(ids ? inArray(schema.clients.id, ids) : undefined)
    .orderBy(asc(schema.clients.name));
  return rows;
}

export async function getClient(actor: Actor, id: string) {
  assertClient(actor, id, 'Cliente');
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, id));
  if (!client) throw notFound('Cliente');
  const projects = await db.select().from(schema.projects).where(eq(schema.projects.clientId, id)).orderBy(asc(schema.projects.name));
  const users = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role, isActive: schema.users.isActive })
    .from(schema.users).where(eq(schema.users.clientId, id));
  return { ...client, projects, users };
}

export async function createClient(actor: Actor, data: { name: string; shortCode?: string; segment?: string; description?: string }) {
  assertAdmin(actor);
  const slug = slugify(data.name);
  const shortCode = (data.shortCode ?? data.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3)).toUpperCase();
  const [existing] = await db.select({ id: schema.clients.id }).from(schema.clients).where(eq(schema.clients.slug, slug));
  if (existing) throw badRequest('Já existe um cliente com este nome.');
  const [client] = await db.insert(schema.clients).values({ name: data.name.trim(), slug, shortCode, segment: data.segment, description: data.description }).returning();
  await audit(actor, 'client.create', 'client', client.id, client.id, { name: client.name });
  return client;
}

export async function listProjects(actor: Actor, clientId?: string) {
  if (clientId) assertClient(actor, clientId, 'Cliente');
  const ids = visibleClientIds(actor);
  if (ids && ids.length === 0) return [];
  return db.select({
    id: schema.projects.id, clientId: schema.projects.clientId, code: schema.projects.code, name: schema.projects.name,
    description: schema.projects.description, isActive: schema.projects.isActive, createdAt: schema.projects.createdAt,
    clientName: schema.clients.name,
  }).from(schema.projects)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.projects.clientId))
    .where(and(
      clientId ? eq(schema.projects.clientId, clientId) : undefined,
      ids ? inArray(schema.projects.clientId, ids) : undefined,
    ))
    .orderBy(asc(schema.clients.name), asc(schema.projects.name));
}

/** Carrega o projeto e garante que o ator enxerga o cliente dono. */
export async function getProject(actor: Actor, projectId: string) {
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  if (!project) throw notFound('Projeto');
  assertClient(actor, project.clientId, 'Projeto');
  return project;
}

export async function createProject(actor: Actor, data: { clientId: string; name: string; code?: string; description?: string }) {
  assertInternal(actor);
  assertClient(actor, data.clientId, 'Cliente');
  const code = (data.code ?? slugify(data.name).slice(0, 12)).toUpperCase();
  const [project] = await db.insert(schema.projects).values({ clientId: data.clientId, name: data.name.trim(), code, description: data.description }).returning();
  await audit(actor, 'project.create', 'project', project.id, data.clientId, { name: project.name });
  return project;
}

export async function listTeam(actor: Actor) {
  assertInternal(actor);
  const rows = await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role })
    .from(schema.users).where(and(inArray(schema.users.role, ['admin_optsolv', 'colaborador_optsolv']), eq(schema.users.isActive, true)))
    .orderBy(asc(schema.users.name));
  return rows;
}
