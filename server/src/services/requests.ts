import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, schema } from '../db/index.js';
import { actorKey, assertClient, assertInternal, isInternal, visibleClientIds, type Actor } from '../auth/actor.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { audit } from './audit.js';
import { getProject } from './clients.js';

export const REQUEST_STATUSES = ['nova', 'em_triagem', 'planejada', 'em_andamento', 'aguardando_cliente', 'concluida', 'cancelada'] as const;
export const REQUEST_CATEGORIES = ['problema', 'melhoria', 'nova_funcionalidade', 'duvida'] as const;
export const REQUEST_PRIORITIES = ['baixa', 'media', 'alta', 'critica'] as const;
export const REQUEST_SOURCES = ['portal', 'admin', 'captura_whatsapp', 'api', 'mcp'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];
export type RequestSource = (typeof REQUEST_SOURCES)[number];

const CLOSED: RequestStatus[] = ['concluida', 'cancelada'];
const assignee = alias(schema.users, 'assignee');

export type RequestFilters = {
  clientId?: string; projectId?: string; status?: RequestStatus[]; category?: RequestCategory; priority?: RequestPriority;
  assigneeUserId?: string; unassigned?: boolean; open?: boolean; search?: string; from?: Date; to?: Date; source?: RequestSource;
  page?: number; pageSize?: number;
};

function scopeWhere(actor: Actor, f: RequestFilters): SQL | undefined {
  const ids = visibleClientIds(actor);
  if (f.clientId) assertClient(actor, f.clientId, 'Cliente');
  const conds: (SQL | undefined)[] = [
    ids ? inArray(schema.requests.clientId, ids) : undefined,
    f.clientId ? eq(schema.requests.clientId, f.clientId) : undefined,
    f.projectId ? eq(schema.requests.projectId, f.projectId) : undefined,
    f.status?.length ? inArray(schema.requests.status, f.status) : undefined,
    f.open ? sql`${schema.requests.status} not in ('concluida','cancelada')` : undefined,
    f.category ? eq(schema.requests.category, f.category) : undefined,
    f.priority ? eq(schema.requests.priority, f.priority) : undefined,
    f.source ? eq(schema.requests.source, f.source) : undefined,
    f.assigneeUserId ? eq(schema.requests.assigneeUserId, f.assigneeUserId) : undefined,
    f.unassigned ? isNull(schema.requests.assigneeUserId) : undefined,
    f.from ? gte(schema.requests.createdAt, f.from) : undefined,
    f.to ? lte(schema.requests.createdAt, f.to) : undefined,
    f.search ? or(ilike(schema.requests.title, `%${f.search}%`), ilike(schema.requests.description, `%${f.search}%`), sql`${schema.requests.number}::text = ${f.search.replace(/\D/g, '') || '-1'}`) : undefined,
  ];
  return and(...conds);
}

const listColumns = (actor: Actor) => ({
  id: schema.requests.id, number: schema.requests.number, title: schema.requests.title, description: schema.requests.description,
  category: schema.requests.category, priority: schema.requests.priority, status: schema.requests.status, source: schema.requests.source,
  authorLabel: schema.requests.authorLabel, createdAt: schema.requests.createdAt, updatedAt: schema.requests.updatedAt, closedAt: schema.requests.closedAt,
  clientId: schema.requests.clientId, clientName: schema.clients.name, clientCode: schema.clients.shortCode,
  projectId: schema.requests.projectId, projectName: schema.projects.name,
  assigneeUserId: schema.requests.assigneeUserId, assigneeName: assignee.name,
  commentCount: sql<number>`(select count(*)::int from ${schema.requestComments} c where c.request_id = ${schema.requests.id}${isInternal(actor) ? sql`` : sql` and c.visibility = 'public'`})`,
  attachmentCount: sql<number>`(select count(*)::int from ${schema.attachments} a where a.request_id = ${schema.requests.id})`,
  deliveryCount: sql<number>`(select count(*)::int from ${schema.deliveryRequests} dr join ${schema.deliveries} d on d.id = dr.delivery_id where dr.request_id = ${schema.requests.id}${isInternal(actor) ? sql`` : sql` and d.status = 'publicada'`})`,
});

export async function listRequests(actor: Actor, f: RequestFilters = {}) {
  const ids = visibleClientIds(actor);
  if (ids && ids.length === 0) return { items: [], total: 0, page: 1, pageSize: f.pageSize ?? 25 };
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25));
  const where = scopeWhere(actor, f);
  const base = db.select(listColumns(actor)).from(schema.requests)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.requests.clientId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.requests.projectId))
    .leftJoin(assignee, eq(assignee.id, schema.requests.assigneeUserId))
    .where(where);
  const [items, [{ total }]] = await Promise.all([
    base.orderBy(desc(schema.requests.updatedAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.requests).where(where),
  ]);
  return { items, total, page, pageSize };
}

export async function getRequest(actor: Actor, id: string) {
  const [row] = await db.select(listColumns(actor)).from(schema.requests)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.requests.clientId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.requests.projectId))
    .leftJoin(assignee, eq(assignee.id, schema.requests.assigneeUserId))
    .where(eq(schema.requests.id, id));
  if (!row) throw notFound('Solicitação');
  assertClient(actor, row.clientId, 'Solicitação');
  const internal = isInternal(actor);
  const [comments, events, attachments, deliveries, source] = await Promise.all([
    db.select().from(schema.requestComments)
      .where(and(eq(schema.requestComments.requestId, id), internal ? undefined : eq(schema.requestComments.visibility, 'public')))
      .orderBy(asc(schema.requestComments.createdAt)),
    db.select().from(schema.requestEvents)
      .where(and(eq(schema.requestEvents.requestId, id), internal ? undefined : eq(schema.requestEvents.isPublic, true)))
      .orderBy(asc(schema.requestEvents.createdAt)),
    db.select({ id: schema.attachments.id, fileName: schema.attachments.fileName, mimeType: schema.attachments.mimeType, sizeBytes: schema.attachments.sizeBytes, uploadedByLabel: schema.attachments.uploadedByLabel, createdAt: schema.attachments.createdAt })
      .from(schema.attachments).where(eq(schema.attachments.requestId, id)).orderBy(asc(schema.attachments.createdAt)),
    db.select({ id: schema.deliveries.id, title: schema.deliveries.title, summary: schema.deliveries.summary, status: schema.deliveries.status, deliveredAt: schema.deliveries.deliveredAt, publishedAt: schema.deliveries.publishedAt })
      .from(schema.deliveryRequests).innerJoin(schema.deliveries, eq(schema.deliveries.id, schema.deliveryRequests.deliveryId))
      .where(and(eq(schema.deliveryRequests.requestId, id), internal ? undefined : eq(schema.deliveries.status, 'publicada'))),
    internal ? db.select({ sourceExcerpt: schema.requests.sourceExcerpt, sourceMessageId: schema.requests.sourceMessageId }).from(schema.requests).where(eq(schema.requests.id, id)) : Promise.resolve([]),
  ]);
  return { ...row, comments, events, attachments, deliveries, sourceExcerpt: source[0]?.sourceExcerpt ?? null, sourceMessageId: source[0]?.sourceMessageId ?? null };
}

export type CreateRequestInput = {
  projectId: string; title?: string; description: string; category?: RequestCategory; priority?: RequestPriority;
  source: RequestSource; authorLabel?: string; sourceMessageId?: string; sourceExcerpt?: string; idempotencyKey?: string;
};

export function deriveTitle(description: string) {
  const first = description.trim().split(/\n|(?<=[.!?])\s/)[0] ?? '';
  const clean = first.replace(/\s+/g, ' ').trim();
  return clean.length > 72 ? clean.slice(0, 69).trimEnd() + '…' : clean || 'Solicitação sem título';
}

export async function createRequest(actor: Actor, input: CreateRequestInput) {
  if (!isInternal(actor) && !['portal', 'api', 'mcp'].includes(input.source)) throw badRequest('Origem inválida para este usuário.');
  const project = await getProject(actor, input.projectId);
  if (!project.isActive) throw badRequest('Projeto inativo.');
  if (input.idempotencyKey) {
    const [hit] = await db.select().from(schema.idempotencyKeys)
      .where(and(eq(schema.idempotencyKeys.key, input.idempotencyKey), eq(schema.idempotencyKeys.actorKey, actorKey(actor))));
    if (hit) return { request: await getRequest(actor, hit.entityId), replayed: true };
  }
  const description = input.description.trim();
  if (description.length < 5) throw badRequest('Descreva a solicitação com pelo menos 5 caracteres.');
  const created = await db.transaction(async (tx) => {
    // Serializa a numeração por cliente: dois pedidos simultâneos recebem números distintos.
    await tx.execute(sql`select 1 from ${schema.clients} where id = ${project.clientId} for update`);
    const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${schema.requests.number}), 0) + 1` })
      .from(schema.requests).where(eq(schema.requests.clientId, project.clientId));
    const [req] = await tx.insert(schema.requests).values({
      clientId: project.clientId, projectId: project.id, number: next,
      title: (input.title?.trim() || deriveTitle(description)).slice(0, 140), description,
      category: input.category ?? 'melhoria', priority: input.priority ?? 'media', status: 'nova', source: input.source,
      // Nome do autor só pode ser informado pela equipe (ex.: remetente da captura de WhatsApp); cliente nunca se passa por outro.
      authorUserId: actor.userId, authorLabel: (isInternal(actor) && input.authorLabel?.trim()) || actor.label,
      sourceMessageId: input.sourceMessageId, sourceExcerpt: input.sourceExcerpt,
    }).returning();
    await tx.insert(schema.requestEvents).values({ requestId: req.id, actorLabel: req.authorLabel, type: 'criada', toValue: input.source, isPublic: true });
    if (input.idempotencyKey) {
      await tx.insert(schema.idempotencyKeys).values({ key: input.idempotencyKey, actorKey: actorKey(actor), entityType: 'request', entityId: req.id });
    }
    return req;
  });
  await audit(actor, 'request.create', 'request', created.id, created.clientId, { number: created.number, source: input.source });
  return { request: await getRequest(actor, created.id), replayed: false };
}

export type UpdateRequestInput = {
  title?: string; description?: string; category?: RequestCategory; priority?: RequestPriority; status?: RequestStatus;
  assigneeUserId?: string | null; reason?: string; note?: string;
};

export async function updateRequest(actor: Actor, id: string, patch: UpdateRequestInput) {
  const [current] = await db.select().from(schema.requests).where(eq(schema.requests.id, id));
  if (!current) throw notFound('Solicitação');
  assertClient(actor, current.clientId, 'Solicitação');
  const internal = isInternal(actor);
  const events: (typeof schema.requestEvents.$inferInsert)[] = [];
  const changes: Partial<typeof schema.requests.$inferInsert> = { updatedAt: new Date() };

  if (!internal) {
    // Cliente só pode reabrir (com motivo) uma solicitação encerrada.
    const reopening = patch.status === 'nova' && CLOSED.includes(current.status);
    if (!reopening || Object.keys(patch).some((k) => !['status', 'reason'].includes(k))) {
      throw badRequest('No portal, você pode comentar ou reabrir uma solicitação concluída informando o motivo.');
    }
  }
  if (patch.status && patch.status !== current.status) {
    const reopening = CLOSED.includes(current.status) && !CLOSED.includes(patch.status);
    if (reopening && !patch.reason?.trim()) throw badRequest('Informe o motivo da reabertura.');
    changes.status = patch.status;
    changes.closedAt = CLOSED.includes(patch.status) ? new Date() : null;
    events.push({ requestId: id, actorLabel: actor.label, type: reopening ? 'reaberta' : 'status', fromValue: current.status, toValue: patch.status, note: reopening ? patch.reason : patch.note, isPublic: true });
  }
  if (internal) {
    if (patch.assigneeUserId !== undefined && patch.assigneeUserId !== current.assigneeUserId) {
      let label: string | null = null;
      if (patch.assigneeUserId) {
        const [u] = await db.select({ name: schema.users.name, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, patch.assigneeUserId));
        if (!u || u.role === 'cliente') throw badRequest('Responsável inválido.');
        label = u.name;
      }
      changes.assigneeUserId = patch.assigneeUserId;
      events.push({ requestId: id, actorLabel: actor.label, type: 'responsavel', fromValue: null, toValue: label ?? 'sem responsável', isPublic: false });
    }
    for (const field of ['category', 'priority'] as const) {
      if (patch[field] && patch[field] !== current[field]) {
        changes[field] = patch[field] as never;
        events.push({ requestId: id, actorLabel: actor.label, type: field === 'category' ? 'categoria' : 'prioridade', fromValue: current[field], toValue: patch[field]!, isPublic: false });
      }
    }
    if (patch.title?.trim()) changes.title = patch.title.trim().slice(0, 140);
    if (patch.description?.trim()) changes.description = patch.description.trim();
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.requests).set(changes).where(eq(schema.requests.id, id));
    if (events.length) await tx.insert(schema.requestEvents).values(events);
  });
  await audit(actor, 'request.update', 'request', id, current.clientId, { fields: Object.keys(changes).filter((k) => k !== 'updatedAt') });
  return getRequest(actor, id);
}

export async function addComment(actor: Actor, id: string, input: { body: string; visibility?: 'public' | 'internal' }) {
  const [current] = await db.select({ clientId: schema.requests.clientId }).from(schema.requests).where(eq(schema.requests.id, id));
  if (!current) throw notFound('Solicitação');
  assertClient(actor, current.clientId, 'Solicitação');
  const body = input.body.trim();
  if (!body) throw badRequest('Escreva o comentário.');
  const visibility = isInternal(actor) ? (input.visibility ?? 'public') : 'public';
  const [comment] = await db.insert(schema.requestComments).values({ requestId: id, authorUserId: actor.userId, authorLabel: actor.label, visibility, body }).returning();
  await db.update(schema.requests).set({ updatedAt: new Date() }).where(eq(schema.requests.id, id));
  await audit(actor, 'request.comment', 'request', id, current.clientId, { visibility });
  return comment;
}

/** Desfazer: o autor apaga o próprio comentário nos primeiros 10 minutos (janela do "Desfazer" no toast). */
export async function deleteComment(actor: Actor, id: string, commentId: string) {
  const [c] = await db.select().from(schema.requestComments).where(and(eq(schema.requestComments.id, commentId), eq(schema.requestComments.requestId, id)));
  if (!c) throw notFound('Comentário');
  const [req] = await db.select({ clientId: schema.requests.clientId }).from(schema.requests).where(eq(schema.requests.id, id));
  assertClient(actor, req!.clientId, 'Comentário');
  if (!actor.userId || c.authorUserId !== actor.userId || Date.now() - c.createdAt.getTime() > 10 * 60_000) throw forbidden('Só o autor pode desfazer, e só nos primeiros 10 minutos.');
  await db.delete(schema.requestComments).where(eq(schema.requestComments.id, commentId));
  await audit(actor, 'request.comment.undo', 'request', id, req!.clientId, { commentId });
}

export async function requestForAttachment(actor: Actor, id: string) {
  const [current] = await db.select({ id: schema.requests.id, clientId: schema.requests.clientId }).from(schema.requests).where(eq(schema.requests.id, id));
  if (!current) throw notFound('Solicitação');
  assertClient(actor, current.clientId, 'Solicitação');
  return current;
}

export async function recordAttachmentEvent(actor: Actor, requestId: string, fileName: string) {
  await db.insert(schema.requestEvents).values({ requestId, actorLabel: actor.label, type: 'anexo', toValue: fileName, isPublic: true });
  await db.update(schema.requests).set({ updatedAt: new Date() }).where(eq(schema.requests.id, requestId));
}

/** Solicitações abertas de um cliente, para a detecção de repetidas na captura. */
export async function openRequestsForClient(actor: Actor, clientId: string) {
  assertInternal(actor);
  assertClient(actor, clientId, 'Cliente');
  return db.select({ id: schema.requests.id, number: schema.requests.number, title: schema.requests.title, description: schema.requests.description, status: schema.requests.status })
    .from(schema.requests).where(and(eq(schema.requests.clientId, clientId), sql`${schema.requests.status} not in ('concluida','cancelada')`));
}
