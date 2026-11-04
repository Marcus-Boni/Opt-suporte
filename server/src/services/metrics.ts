import { and, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { assertClient, isInternal, visibleClientIds, type Actor } from '../auth/actor.js';

export type MetricsFilters = { clientId?: string; projectId?: string; from?: Date; to?: Date };

function monthKeys(from: Date, to: Date) {
  const keys: string[] = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (d <= to && keys.length < 24) {
    keys.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return keys;
}

/** Todos os números abaixo são contados no banco com os filtros informados; nada é estimado. */
export async function metricsSummary(actor: Actor, f: MetricsFilters) {
  const ids = visibleClientIds(actor);
  if (f.clientId) assertClient(actor, f.clientId, 'Cliente');
  const to = f.to ?? new Date();
  const from = f.from ?? new Date(to.getTime() - 180 * 86_400_000);
  const empty = ids !== null && ids.length === 0;

  const reqScope = and(
    ids ? inArray(schema.requests.clientId, ids) : undefined,
    f.clientId ? eq(schema.requests.clientId, f.clientId) : undefined,
    f.projectId ? eq(schema.requests.projectId, f.projectId) : undefined,
  );
  const delScope = and(
    ids ? inArray(schema.deliveries.clientId, ids) : undefined,
    f.clientId ? eq(schema.deliveries.clientId, f.clientId) : undefined,
    f.projectId ? eq(schema.deliveries.projectId, f.projectId) : undefined,
    eq(schema.deliveries.status, 'publicada'),
  );
  const inPeriod = (col: SQL | typeof schema.requests.createdAt) => and(gte(col as never, from), lte(col as never, to));

  if (empty) {
    return { period: { from, to }, totals: emptyTotals(), byStatus: {}, byCategory: {}, bySource: {}, monthly: [], highlights: [] as Highlight[], clients: [] };
  }

  // Uma consulta para todas as contagens de solicitações (count ... filter), em vez de uma por indicador.
  const inP = (col: typeof schema.requests.createdAt | typeof schema.requests.closedAt) => sql`${col} between ${from} and ${to}`;
  const [[req], [published], [evidences], statusRows, categoryRows, sourceRows, monthlyCreated, monthlyConcluded, monthlyPublished, highlights, perClient] = await Promise.all([
    db.select({
      created: sql<number>`count(*) filter (where ${inP(schema.requests.createdAt)})::int`,
      concluded: sql<number>`count(*) filter (where ${schema.requests.status} = 'concluida' and ${inP(schema.requests.closedAt)})::int`,
      openNow: sql<number>`count(*) filter (where ${schema.requests.status} not in ('concluida','cancelada'))::int`,
      unassigned: sql<number>`count(*) filter (where ${schema.requests.status} not in ('concluida','cancelada') and ${schema.requests.assigneeUserId} is null)::int`,
      waitingClient: sql<number>`count(*) filter (where ${schema.requests.status} = 'aguardando_cliente')::int`,
      median: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from (${schema.requests.closedAt} - ${schema.requests.createdAt})) / 86400) filter (where ${schema.requests.status} = 'concluida' and ${inP(schema.requests.closedAt)})`,
    }).from(schema.requests).where(reqScope),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.deliveries).where(and(delScope, inPeriod(schema.deliveries.publishedAt as never))),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.valueEvidences).innerJoin(schema.deliveries, eq(schema.deliveries.id, schema.valueEvidences.deliveryId)).where(and(delScope, inPeriod(schema.deliveries.publishedAt as never))),
    db.select({ k: schema.requests.status, n: sql<number>`count(*)::int` }).from(schema.requests).where(reqScope).groupBy(schema.requests.status),
    db.select({ k: schema.requests.category, n: sql<number>`count(*)::int` }).from(schema.requests).where(and(reqScope, inPeriod(schema.requests.createdAt))).groupBy(schema.requests.category),
    db.select({ k: schema.requests.source, n: sql<number>`count(*)::int` }).from(schema.requests).where(and(reqScope, inPeriod(schema.requests.createdAt))).groupBy(schema.requests.source),
    db.select({ m: sql<string>`to_char(${schema.requests.createdAt} at time zone 'UTC', 'YYYY-MM')`, n: sql<number>`count(*)::int` }).from(schema.requests).where(and(reqScope, inPeriod(schema.requests.createdAt))).groupBy(sql`1`),
    db.select({ m: sql<string>`to_char(${schema.requests.closedAt} at time zone 'UTC', 'YYYY-MM')`, n: sql<number>`count(*)::int` }).from(schema.requests).where(and(reqScope, eq(schema.requests.status, 'concluida'), inPeriod(schema.requests.closedAt as never))).groupBy(sql`1`),
    db.select({ m: sql<string>`to_char(${schema.deliveries.publishedAt} at time zone 'UTC', 'YYYY-MM')`, n: sql<number>`count(*)::int` }).from(schema.deliveries).where(and(delScope, inPeriod(schema.deliveries.publishedAt as never))).groupBy(sql`1`),
    db.select({
      id: schema.deliveries.id, title: schema.deliveries.title, summary: schema.deliveries.summary, publishedAt: schema.deliveries.publishedAt,
      clientId: schema.deliveries.clientId, clientName: schema.clients.name, projectName: schema.projects.name,
      evidenceCount: sql<number>`(select count(*)::int from ${schema.valueEvidences} e where e.delivery_id = ${schema.deliveries.id})`,
      measuredCount: sql<number>`(select count(*)::int from ${schema.valueEvidences} e where e.delivery_id = ${schema.deliveries.id} and e.kind = 'medido')`,
      requestCount: sql<number>`(select count(*)::int from ${schema.deliveryRequests} dr where dr.delivery_id = ${schema.deliveries.id})`,
    }).from(schema.deliveries)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.deliveries.clientId))
      .innerJoin(schema.projects, eq(schema.projects.id, schema.deliveries.projectId))
      .where(and(delScope, inPeriod(schema.deliveries.publishedAt as never)))
      .orderBy(sql`5 desc, ${schema.deliveries.publishedAt} desc`).limit(6),
    isInternal(actor)
      ? db.select({
        clientId: schema.clients.id, clientName: schema.clients.name, clientCode: schema.clients.shortCode,
        open: sql<number>`(select count(*)::int from ${schema.requests} r where r.client_id = ${schema.clients}.id and r.status not in ('concluida','cancelada'))`,
        concluded: sql<number>`(select count(*)::int from ${schema.requests} r where r.client_id = ${schema.clients}.id and r.status = 'concluida' and r.closed_at between ${from} and ${to})`,
        published: sql<number>`(select count(*)::int from ${schema.deliveries} d where d.client_id = ${schema.clients}.id and d.status = 'publicada' and d.published_at between ${from} and ${to})`,
        unassigned: sql<number>`(select count(*)::int from ${schema.requests} r where r.client_id = ${schema.clients}.id and r.status not in ('concluida','cancelada') and r.assignee_user_id is null)`,
      }).from(schema.clients).where(ids ? inArray(schema.clients.id, ids) : undefined).orderBy(schema.clients.name)
      : Promise.resolve([]),
  ]);

  const toMap = (rows: { k: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r.k, r.n]));
  const mc = Object.fromEntries(monthlyCreated.map((r) => [r.m, r.n]));
  const mo = Object.fromEntries(monthlyConcluded.map((r) => [r.m, r.n]));
  const mp = Object.fromEntries(monthlyPublished.map((r) => [r.m, r.n]));
  const monthly = monthKeys(from, to).map((m) => ({ month: m, created: mc[m] ?? 0, concluded: mo[m] ?? 0, published: mp[m] ?? 0 }));

  return {
    period: { from, to },
    totals: {
      requestsCreated: req.created, requestsConcluded: req.concluded, requestsOpen: req.openNow,
      unassigned: isInternal(actor) ? req.unassigned : null, waitingClient: req.waitingClient,
      deliveriesPublished: published.n, evidences: evidences.n,
      medianLeadDays: req.median === null ? null : Math.round(Number(req.median) * 10) / 10,
    },
    byStatus: toMap(statusRows), byCategory: toMap(categoryRows), bySource: toMap(sourceRows),
    monthly, highlights: highlights as Highlight[], clients: perClient,
  };
}

type Highlight = { id: string; title: string; summary: string; publishedAt: Date | null; clientId: string; clientName: string; projectName: string; evidenceCount: number; measuredCount: number; requestCount: number };

const emptyTotals = () => ({ requestsCreated: 0, requestsConcluded: 0, requestsOpen: 0, unassigned: 0, waitingClient: 0, deliveriesPublished: 0, evidences: 0, medianLeadDays: null as number | null });
