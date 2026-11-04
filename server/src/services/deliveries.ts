import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { assertClient, assertInternal, isInternal, visibleClientIds, type Actor } from '../auth/actor.js';
import { badRequest, notFound } from '../lib/errors.js';
import { audit } from './audit.js';
import { getProject } from './clients.js';

export const EVIDENCE_KINDS = ['observado', 'esperado', 'medido'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type DeliveryFilters = { clientId?: string; projectId?: string; status?: 'rascunho' | 'publicada'; from?: Date; to?: Date; page?: number; pageSize?: number };

function scopeWhere(actor: Actor, f: DeliveryFilters): SQL | undefined {
  const ids = visibleClientIds(actor);
  if (f.clientId) assertClient(actor, f.clientId, 'Cliente');
  return and(
    ids ? inArray(schema.deliveries.clientId, ids) : undefined,
    isInternal(actor) ? (f.status ? eq(schema.deliveries.status, f.status) : undefined) : eq(schema.deliveries.status, 'publicada'),
    f.clientId ? eq(schema.deliveries.clientId, f.clientId) : undefined,
    f.projectId ? eq(schema.deliveries.projectId, f.projectId) : undefined,
    f.from ? gte(schema.deliveries.deliveredAt, f.from) : undefined,
    f.to ? lte(schema.deliveries.deliveredAt, f.to) : undefined,
  );
}

const columns = {
  id: schema.deliveries.id, title: schema.deliveries.title, summary: schema.deliveries.summary, details: schema.deliveries.details,
  status: schema.deliveries.status, ownerLabel: schema.deliveries.ownerLabel, ownerUserId: schema.deliveries.ownerUserId,
  deliveredAt: schema.deliveries.deliveredAt, publishedAt: schema.deliveries.publishedAt, createdAt: schema.deliveries.createdAt, updatedAt: schema.deliveries.updatedAt,
  clientId: schema.deliveries.clientId, clientName: schema.clients.name, clientCode: schema.clients.shortCode,
  projectId: schema.deliveries.projectId, projectName: schema.projects.name,
  requestCount: sql<number>`(select count(*)::int from ${schema.deliveryRequests} dr where dr.delivery_id = ${schema.deliveries.id})`,
  evidenceCount: sql<number>`(select count(*)::int from ${schema.valueEvidences} e where e.delivery_id = ${schema.deliveries.id})`,
};

export async function listDeliveries(actor: Actor, f: DeliveryFilters = {}) {
  const ids = visibleClientIds(actor);
  if (ids && ids.length === 0) return { items: [], total: 0 };
  const where = scopeWhere(actor, f);
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25));
  const [items, [{ total }]] = await Promise.all([
    db.select(columns).from(schema.deliveries)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.deliveries.clientId))
      .innerJoin(schema.projects, eq(schema.projects.id, schema.deliveries.projectId))
      .where(where).orderBy(desc(schema.deliveries.deliveredAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.deliveries).where(where),
  ]);
  return { items, total, page, pageSize };
}

export async function getDelivery(actor: Actor, id: string) {
  const [row] = await db.select(columns).from(schema.deliveries)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.deliveries.clientId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.deliveries.projectId))
    .where(eq(schema.deliveries.id, id));
  if (!row) throw notFound('Entrega');
  assertClient(actor, row.clientId, 'Entrega');
  if (!isInternal(actor) && row.status !== 'publicada') throw notFound('Entrega');
  const [requests, evidences, attachments] = await Promise.all([
    db.select({ id: schema.requests.id, number: schema.requests.number, title: schema.requests.title, status: schema.requests.status, category: schema.requests.category, source: schema.requests.source })
      .from(schema.deliveryRequests).innerJoin(schema.requests, eq(schema.requests.id, schema.deliveryRequests.requestId))
      .where(eq(schema.deliveryRequests.deliveryId, id)).orderBy(asc(schema.requests.number)),
    db.select().from(schema.valueEvidences).where(eq(schema.valueEvidences.deliveryId, id)).orderBy(asc(schema.valueEvidences.createdAt)),
    db.select({ id: schema.attachments.id, fileName: schema.attachments.fileName, mimeType: schema.attachments.mimeType, sizeBytes: schema.attachments.sizeBytes, uploadedByLabel: schema.attachments.uploadedByLabel, createdAt: schema.attachments.createdAt })
      .from(schema.attachments).where(eq(schema.attachments.deliveryId, id)),
  ]);
  return { ...row, requests, evidences, attachments };
}

export async function createDelivery(actor: Actor, input: { projectId: string; title: string; summary: string; details?: string; deliveredAt?: Date; requestIds?: string[]; idempotencyKey?: string }) {
  assertInternal(actor);
  const project = await getProject(actor, input.projectId);
  if (input.idempotencyKey) {
    const [hit] = await db.select().from(schema.idempotencyKeys)
      .where(and(eq(schema.idempotencyKeys.key, input.idempotencyKey), eq(schema.idempotencyKeys.actorKey, `${actor.kind}:${actor.id}`)));
    if (hit) return getDelivery(actor, hit.entityId);
  }
  if (!input.title.trim() || !input.summary.trim()) throw badRequest('Informe nome e resumo da entrega.');
  const delivery = await db.transaction(async (tx) => {
    const [row] = await tx.insert(schema.deliveries).values({
      clientId: project.clientId, projectId: project.id, title: input.title.trim(), summary: input.summary.trim(), details: input.details?.trim() || null,
      ownerUserId: actor.userId, ownerLabel: actor.label, deliveredAt: input.deliveredAt ?? new Date(),
    }).returning();
    if (input.idempotencyKey) {
      await tx.insert(schema.idempotencyKeys).values({ key: input.idempotencyKey, actorKey: `${actor.kind}:${actor.id}`, entityType: 'delivery', entityId: row.id });
    }
    return row;
  });
  await audit(actor, 'delivery.create', 'delivery', delivery.id, delivery.clientId, { title: delivery.title });
  if (input.requestIds?.length) await linkRequests(actor, delivery.id, input.requestIds);
  return getDelivery(actor, delivery.id);
}

export async function updateDelivery(actor: Actor, id: string, patch: { title?: string; summary?: string; details?: string | null; deliveredAt?: Date; status?: 'rascunho' | 'publicada' }) {
  assertInternal(actor);
  const [current] = await db.select().from(schema.deliveries).where(eq(schema.deliveries.id, id));
  if (!current) throw notFound('Entrega');
  assertClient(actor, current.clientId, 'Entrega');
  const changes: Partial<typeof schema.deliveries.$inferInsert> = { updatedAt: new Date() };
  if (patch.title?.trim()) changes.title = patch.title.trim();
  if (patch.summary?.trim()) changes.summary = patch.summary.trim();
  if (patch.details !== undefined) changes.details = patch.details?.trim() || null;
  if (patch.deliveredAt) changes.deliveredAt = patch.deliveredAt;
  const publishing = patch.status === 'publicada' && current.status !== 'publicada';
  if (patch.status) {
    changes.status = patch.status;
    if (publishing) changes.publishedAt = new Date();
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.deliveries).set(changes).where(eq(schema.deliveries.id, id));
    if (publishing) {
      const linked = await tx.select({ requestId: schema.deliveryRequests.requestId }).from(schema.deliveryRequests).where(eq(schema.deliveryRequests.deliveryId, id));
      if (linked.length) {
        await tx.insert(schema.requestEvents).values(linked.map((l) => ({
          requestId: l.requestId, actorLabel: actor.label, type: 'entrega_publicada', toValue: changes.title ?? current.title, note: id, isPublic: true,
        })));
        await tx.update(schema.requests).set({ updatedAt: new Date() }).where(inArray(schema.requests.id, linked.map((l) => l.requestId)));
      }
    }
  });
  await audit(actor, publishing ? 'delivery.publish' : 'delivery.update', 'delivery', id, current.clientId, { fields: Object.keys(changes) });
  return getDelivery(actor, id);
}

export async function linkRequests(actor: Actor, deliveryId: string, requestIds: string[]) {
  assertInternal(actor);
  const [delivery] = await db.select().from(schema.deliveries).where(eq(schema.deliveries.id, deliveryId));
  if (!delivery) throw notFound('Entrega');
  assertClient(actor, delivery.clientId, 'Entrega');
  const unique = [...new Set(requestIds)];
  if (!unique.length) return getDelivery(actor, deliveryId);
  const found = await db.select({ id: schema.requests.id, clientId: schema.requests.clientId, number: schema.requests.number })
    .from(schema.requests).where(inArray(schema.requests.id, unique));
  // Toda solicitação precisa existir E pertencer ao mesmo cliente da entrega.
  if (found.length !== unique.length || found.some((r) => r.clientId !== delivery.clientId)) throw notFound('Solicitação');
  await db.transaction(async (tx) => {
    await tx.insert(schema.deliveryRequests).values(unique.map((requestId) => ({ deliveryId, requestId }))).onConflictDoNothing();
    await tx.insert(schema.requestEvents).values(unique.map((requestId) => ({
      requestId, actorLabel: actor.label, type: 'entrega_vinculada', toValue: delivery.title, note: deliveryId, isPublic: delivery.status === 'publicada',
    })));
    await tx.update(schema.requests).set({ updatedAt: new Date() }).where(inArray(schema.requests.id, unique));
  });
  await audit(actor, 'delivery.link_requests', 'delivery', deliveryId, delivery.clientId, { requests: found.map((r) => r.number) });
  return getDelivery(actor, deliveryId);
}

export async function unlinkRequest(actor: Actor, deliveryId: string, requestId: string) {
  assertInternal(actor);
  const [delivery] = await db.select().from(schema.deliveries).where(eq(schema.deliveries.id, deliveryId));
  if (!delivery) throw notFound('Entrega');
  assertClient(actor, delivery.clientId, 'Entrega');
  await db.delete(schema.deliveryRequests).where(and(eq(schema.deliveryRequests.deliveryId, deliveryId), eq(schema.deliveryRequests.requestId, requestId)));
  return getDelivery(actor, deliveryId);
}

export async function addEvidence(actor: Actor, deliveryId: string, input: { kind: EvidenceKind; title: string; description?: string; metricValue?: number | null; metricUnit?: string; sourceLabel?: string; linkUrl?: string; attachmentId?: string }) {
  assertInternal(actor);
  const [delivery] = await db.select().from(schema.deliveries).where(eq(schema.deliveries.id, deliveryId));
  if (!delivery) throw notFound('Entrega');
  assertClient(actor, delivery.clientId, 'Entrega');
  if (!input.title.trim()) throw badRequest('Dê um título à evidência.');
  if (input.kind === 'medido' && (input.metricValue === undefined || input.metricValue === null)) {
    throw badRequest('Um impacto medido precisa de valor numérico e fonte.');
  }
  if (input.attachmentId) {
    const [att] = await db.select({ clientId: schema.attachments.clientId }).from(schema.attachments).where(eq(schema.attachments.id, input.attachmentId));
    if (!att || att.clientId !== delivery.clientId) throw notFound('Anexo');
  }
  const [evidence] = await db.insert(schema.valueEvidences).values({
    deliveryId, kind: input.kind, title: input.title.trim(), description: input.description?.trim() || null,
    metricValue: input.metricValue === undefined || input.metricValue === null ? null : String(input.metricValue),
    metricUnit: input.metricUnit?.trim() || null, sourceLabel: input.sourceLabel?.trim() || null, linkUrl: input.linkUrl?.trim() || null, attachmentId: input.attachmentId,
  }).returning();
  await db.update(schema.deliveries).set({ updatedAt: new Date() }).where(eq(schema.deliveries.id, deliveryId));
  await audit(actor, 'delivery.evidence', 'delivery', deliveryId, delivery.clientId, { kind: input.kind });
  return evidence;
}

export async function deliveryForAttachment(actor: Actor, id: string) {
  assertInternal(actor);
  const [d] = await db.select({ id: schema.deliveries.id, clientId: schema.deliveries.clientId }).from(schema.deliveries).where(eq(schema.deliveries.id, id));
  if (!d) throw notFound('Entrega');
  assertClient(actor, d.clientId, 'Entrega');
  return d;
}
