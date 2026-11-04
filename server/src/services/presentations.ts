import { and, asc, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, schema, type Slide } from '../db/index.js';
import { assertClient, assertInternal, isInternal, visibleClientIds, type Actor } from '../auth/actor.js';
import { badRequest, notFound } from '../lib/errors.js';
import { audit } from './audit.js';
import { metricsSummary } from './metrics.js';

const STATUS_LABEL: Record<string, string> = {
  nova: 'Nova', em_triagem: 'Em triagem', planejada: 'Planejada', em_andamento: 'Em andamento', aguardando_cliente: 'Aguardando cliente', concluida: 'Concluída', cancelada: 'Cancelada',
};
const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtMonth = (m: string) => { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }); };
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/**
 * Gera slides exclusivamente a partir dos registros do banco no recorte pedido.
 * Onde não há dado, o texto diz "Não informado" — nunca preenche com estimativas.
 */
export async function generatePresentation(actor: Actor, input: { clientId: string; projectIds?: string[]; periodStart: Date; periodEnd: Date; title?: string }) {
  assertInternal(actor);
  assertClient(actor, input.clientId, 'Cliente');
  if (input.periodEnd < input.periodStart) throw badRequest('O fim do período precisa ser depois do início.');
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.id, input.clientId));
  if (!client) throw notFound('Cliente');
  const allProjects = await db.select().from(schema.projects).where(eq(schema.projects.clientId, input.clientId)).orderBy(asc(schema.projects.name));
  const projectIds = input.projectIds?.length ? allProjects.filter((p) => input.projectIds!.includes(p.id)).map((p) => p.id) : allProjects.map((p) => p.id);
  if (!projectIds.length) throw badRequest('Nenhum projeto válido selecionado.');
  const projects = allProjects.filter((p) => projectIds.includes(p.id));
  const from = input.periodStart, to = input.periodEnd;

  const projectScope = inArray(schema.requests.projectId, projectIds);
  const [requests, deliveries] = await Promise.all([
    db.select({ id: schema.requests.id, number: schema.requests.number, title: schema.requests.title, status: schema.requests.status, category: schema.requests.category, createdAt: schema.requests.createdAt, closedAt: schema.requests.closedAt, source: schema.requests.source })
      .from(schema.requests)
      .where(and(projectScope, or(
        and(gte(schema.requests.createdAt, from), lte(schema.requests.createdAt, to)),
        and(gte(schema.requests.closedAt, from), lte(schema.requests.closedAt, to)),
        inArray(schema.requests.status, ['planejada', 'em_andamento', 'aguardando_cliente']),
      )))
      .orderBy(desc(schema.requests.updatedAt)),
    db.select().from(schema.deliveries)
      .where(and(inArray(schema.deliveries.projectId, projectIds), eq(schema.deliveries.status, 'publicada'), gte(schema.deliveries.publishedAt, from), lte(schema.deliveries.publishedAt, to)))
      .orderBy(asc(schema.deliveries.publishedAt)),
  ]);
  const deliveryIds = deliveries.map((d) => d.id);
  const [evidences, links] = deliveryIds.length ? await Promise.all([
    db.select().from(schema.valueEvidences).where(inArray(schema.valueEvidences.deliveryId, deliveryIds)),
    db.select({ deliveryId: schema.deliveryRequests.deliveryId, id: schema.requests.id, number: schema.requests.number, title: schema.requests.title })
      .from(schema.deliveryRequests).innerJoin(schema.requests, eq(schema.requests.id, schema.deliveryRequests.requestId)).where(inArray(schema.deliveryRequests.deliveryId, deliveryIds)),
  ]) : [[], []];
  const metrics = input.projectIds?.length === 1
    ? await metricsSummary(actor, { clientId: input.clientId, projectId: projectIds[0], from, to })
    : await metricsSummary(actor, { clientId: input.clientId, from, to });

  const createdIn = requests.filter((r) => r.createdAt >= from && r.createdAt <= to);
  const concludedIn = requests.filter((r) => r.status === 'concluida' && r.closedAt && r.closedAt >= from && r.closedAt <= to);
  const inProgress = requests.filter((r) => ['planejada', 'em_andamento', 'aguardando_cliente'].includes(r.status));
  const code = client.shortCode;
  const ref = (r: { id: string; number: number; title: string }) => ({ type: 'request' as const, id: r.id, label: `${code}-${r.number} · ${r.title}` });

  const slides: Slide[] = [];
  slides.push({
    id: randomUUID(), kind: 'capa', title: input.title?.trim() || `Resultados ${client.name}`,
    body: `${fmtDate(from)} a ${fmtDate(to)} · ${projects.map((p) => p.name).join(', ')}`,
    data: { clientName: client.name, periodStart: from.toISOString(), periodEnd: to.toISOString(), projects: projects.map((p) => p.name) },
  });
  slides.push({
    id: randomUUID(), kind: 'contexto', title: 'O período em números',
    body: createdIn.length || concludedIn.length || deliveries.length
      ? `No período foram registradas ${plural(createdIn.length, 'solicitação', 'solicitações')}, ${plural(concludedIn.length, 'foi concluída', 'foram concluídas')} e ${plural(deliveries.length, 'entrega foi publicada', 'entregas foram publicadas')}${metrics.totals.medianLeadDays !== null ? `, com tempo mediano de conclusão de ${metrics.totals.medianLeadDays.toLocaleString('pt-BR')} dias` : ''}. Todos os números vêm dos registros da plataforma.`
      : 'Não há solicitações nem entregas registradas para este recorte. Os números abaixo refletem exatamente o banco de dados.',
    data: {
      requestsCreated: createdIn.length, requestsConcluded: concludedIn.length, deliveriesPublished: deliveries.length,
      evidences: evidences.length, medianLeadDays: metrics.totals.medianLeadDays, requestsOpen: metrics.totals.requestsOpen,
      byCategory: metrics.byCategory, bySource: metrics.bySource,
    },
  });
  const relevant = [...concludedIn, ...inProgress.filter((r) => !concludedIn.includes(r))].slice(0, 8);
  slides.push({
    id: randomUUID(), kind: 'solicitacoes', title: 'Solicitações em destaque',
    body: relevant.length ? 'Demandas concluídas no período e as que seguem em andamento, com a situação atual registrada.' : 'Não informado: nenhuma solicitação relevante no recorte.',
    data: { items: relevant.map((r) => ({ id: r.id, code: `${code}-${r.number}`, title: r.title, status: STATUS_LABEL[r.status], category: r.category, closedAt: r.closedAt?.toISOString() ?? null })) },
    refs: relevant.map(ref),
  });
  for (const d of deliveries.slice(0, 8)) {
    const evs = evidences.filter((e) => e.deliveryId === d.id);
    const linked = links.filter((l) => l.deliveryId === d.id);
    const group = (kind: string) => evs.filter((e) => e.kind === kind).map((e) => ({ title: e.title, description: e.description, value: e.metricValue === null ? null : Number(e.metricValue), unit: e.metricUnit, source: e.sourceLabel, link: e.linkUrl }));
    slides.push({
      id: randomUUID(), kind: 'entrega', title: d.title,
      body: d.summary,
      data: {
        deliveryId: d.id, publishedAt: d.publishedAt?.toISOString(), details: d.details,
        requests: linked.map((l) => `${code}-${l.number} · ${l.title}`),
        observado: group('observado'), esperado: group('esperado'), medido: group('medido'),
        hasEvidence: evs.length > 0,
      },
      refs: [{ type: 'delivery', id: d.id, label: d.title }, ...linked.map(ref)],
    });
  }
  if (!deliveries.length) {
    slides.push({ id: randomUUID(), kind: 'entrega', title: 'Entregas publicadas', body: 'Não informado: nenhuma entrega publicada neste período.', data: { empty: true } });
  }
  slides.push({
    id: randomUUID(), kind: 'evolucao', title: 'Evolução mês a mês',
    body: metrics.monthly.some((m) => m.created || m.concluded || m.published) ? 'Solicitações abertas, concluídas e entregas publicadas por mês, contadas no banco.' : 'Não informado: sem movimentação registrada no período.',
    data: { monthly: metrics.monthly.map((m) => ({ ...m, label: fmtMonth(m.month) })) },
  });
  slides.push({
    id: randomUUID(), kind: 'proximos', title: 'Próximos passos',
    body: inProgress.length ? 'O que já está planejado ou em andamento, conforme o status público de cada solicitação.' : 'Não informado: nenhuma solicitação planejada ou em andamento.',
    data: { items: inProgress.slice(0, 6).map((r) => ({ id: r.id, code: `${code}-${r.number}`, title: r.title, status: STATUS_LABEL[r.status] })) },
    refs: inProgress.slice(0, 6).map(ref),
  });
  slides.push({ id: randomUUID(), kind: 'encerramento', title: 'Obrigado', body: `Apresentação preparada pela Optsolv para ${client.name}. Cada item tem origem rastreável na plataforma.` });

  const [presentation] = await db.insert(schema.presentations).values({
    clientId: input.clientId, title: slides[0].title, periodStart: from, periodEnd: to, projectIds, slides, createdByLabel: actor.label,
  }).returning();
  await audit(actor, 'presentation.generate', 'presentation', presentation.id, input.clientId, { slides: slides.length });
  return presentation;
}

export async function listPresentations(actor: Actor, clientId?: string) {
  const ids = visibleClientIds(actor);
  if (ids && ids.length === 0) return [];
  if (clientId) assertClient(actor, clientId, 'Cliente');
  return db.select({
    id: schema.presentations.id, title: schema.presentations.title, status: schema.presentations.status, periodStart: schema.presentations.periodStart, periodEnd: schema.presentations.periodEnd,
    clientId: schema.presentations.clientId, clientName: schema.clients.name, createdByLabel: schema.presentations.createdByLabel, generatedAt: schema.presentations.generatedAt, updatedAt: schema.presentations.updatedAt,
    slideCount: sql<number>`jsonb_array_length(${schema.presentations.slides})`,
  }).from(schema.presentations).innerJoin(schema.clients, eq(schema.clients.id, schema.presentations.clientId))
    .where(and(
      ids ? inArray(schema.presentations.clientId, ids) : undefined,
      clientId ? eq(schema.presentations.clientId, clientId) : undefined,
      isInternal(actor) ? undefined : eq(schema.presentations.status, 'compartilhada'),
    )).orderBy(desc(schema.presentations.generatedAt));
}

export async function getPresentation(actor: Actor, id: string) {
  const [row] = await db.select({ presentation: schema.presentations, clientName: schema.clients.name })
    .from(schema.presentations).innerJoin(schema.clients, eq(schema.clients.id, schema.presentations.clientId)).where(eq(schema.presentations.id, id));
  if (!row) throw notFound('Apresentação');
  assertClient(actor, row.presentation.clientId, 'Apresentação');
  if (!isInternal(actor) && row.presentation.status !== 'compartilhada') throw notFound('Apresentação');
  const projects = row.presentation.projectIds.length
    ? await db.select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects).where(inArray(schema.projects.id, row.presentation.projectIds))
    : [];
  return { ...row.presentation, clientName: row.clientName, projects };
}

export async function updatePresentation(actor: Actor, id: string, patch: { title?: string; status?: 'rascunho' | 'compartilhada'; slides?: { id: string; title?: string; body?: string }[] }) {
  assertInternal(actor);
  const [current] = await db.select().from(schema.presentations).where(eq(schema.presentations.id, id));
  if (!current) throw notFound('Apresentação');
  assertClient(actor, current.clientId, 'Apresentação');
  const changes: Partial<typeof schema.presentations.$inferInsert> = { updatedAt: new Date() };
  if (patch.title?.trim()) changes.title = patch.title.trim();
  if (patch.status) changes.status = patch.status;
  if (patch.slides?.length) {
    // Só título e narrativa são editáveis; os dados calculados permanecem intactos.
    changes.slides = current.slides.map((s) => {
      const edit = patch.slides!.find((e) => e.id === s.id);
      return edit ? { ...s, title: edit.title?.trim() || s.title, body: edit.body ?? s.body } : s;
    });
    if (changes.slides[0]?.kind === 'capa' && !patch.title) changes.title = changes.slides[0].title;
  }
  await db.update(schema.presentations).set(changes).where(eq(schema.presentations.id, id));
  await audit(actor, patch.status === 'compartilhada' ? 'presentation.share' : 'presentation.update', 'presentation', id, current.clientId);
  return getPresentation(actor, id);
}

export async function deletePresentation(actor: Actor, id: string) {
  assertInternal(actor);
  const [current] = await db.select().from(schema.presentations).where(eq(schema.presentations.id, id));
  if (!current) throw notFound('Apresentação');
  assertClient(actor, current.clientId, 'Apresentação');
  await db.delete(schema.presentations).where(eq(schema.presentations.id, id));
  await audit(actor, 'presentation.delete', 'presentation', id, current.clientId);
}
