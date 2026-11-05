import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Actor } from '../auth/actor.js';
import { HttpError } from '../lib/errors.js';
import { listClients, listProjects } from '../services/clients.js';
import { addComment, createRequest, createRequestLimit, getRequest, listRequests, REQUEST_CATEGORIES, REQUEST_PRIORITIES, REQUEST_STATUSES } from '../services/requests.js';
import { createDelivery, linkRequests } from '../services/deliveries.js';
import { metricsSummary } from '../services/metrics.js';
import { generatePresentation } from '../services/presentations.js';

/**
 * Servidor MCP construído sobre a MESMA camada de serviços da API REST.
 * Toda ferramenta recebe o ator já resolvido a partir da credencial; o escopo de clientes é imposto pelos serviços.
 */
export function createMcpServer(actor: Actor) {
  const server = new McpServer({ name: 'optsolv-suporte', version: '1.0.0' });

  const ok = (summary: string, data: unknown) => ({ content: [{ type: 'text' as const, text: `${summary}\n\n${JSON.stringify(data, null, 2)}` }], structuredContent: data as Record<string, unknown> });
  const run = async <T,>(fn: () => Promise<T>, summarize: (r: T) => string) => {
    try {
      const result = await fn();
      return ok(summarize(result), result);
    } catch (e) {
      const msg = e instanceof HttpError ? `${e.code}: ${e.message}` : (e as Error).message;
      return { isError: true, content: [{ type: 'text' as const, text: msg }] };
    }
  };
  const uuid = z.string().uuid();

  server.registerTool('list_clients', {
    title: 'Listar clientes', description: 'Clientes que esta credencial pode acessar, com contadores.',
    inputSchema: {},
  }, async () => run(async () => ({ clients: await listClients(actor) }), (r) => `${r.clients.length} cliente(s) acessível(is).`));

  server.registerTool('list_projects', {
    title: 'Listar projetos', description: 'Projetos de um cliente autorizado (ou de todos os clientes visíveis).',
    inputSchema: { clientId: uuid.optional() },
  }, async ({ clientId }) => run(async () => ({ projects: await listProjects(actor, clientId) }), (r) => `${r.projects.length} projeto(s).`));

  server.registerTool('search_requests', {
    title: 'Pesquisar solicitações', description: 'Lista paginada de solicitações no escopo autorizado, com filtros.',
    inputSchema: {
      clientId: uuid.optional(), projectId: uuid.optional(), status: z.array(z.enum(REQUEST_STATUSES)).optional(), open: z.boolean().optional(),
      search: z.string().max(120).optional(), page: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).max(100).optional(),
    },
  }, async (input) => run(() => listRequests(actor, input), (r) => `${r.total} solicitação(ões); página ${r.page}.`));

  server.registerTool('get_request', {
    title: 'Detalhar solicitação', description: 'Detalhe completo (comentários conforme papel, histórico, anexos, entregas).',
    inputSchema: { id: uuid },
  }, async ({ id }) => run(() => getRequest(actor, id), (r) => `${r.clientCode}-${r.number} · ${r.title} [${r.status}]`));

  server.registerTool('create_request', {
    title: 'Criar solicitação', description: 'Cria uma solicitação (origem "mcp") em um projeto autorizado. Use idempotencyKey para evitar duplicatas em novas tentativas.',
    inputSchema: {
      projectId: uuid, description: z.string().min(5).max(5000), title: z.string().max(140).optional(),
      category: z.enum(REQUEST_CATEGORIES).optional(), priority: z.enum(REQUEST_PRIORITIES).optional(), idempotencyKey: z.string().max(120).optional(),
    },
  }, async (input) => run(() => { createRequestLimit.check(actor.id); createRequestLimit.hit(actor.id); return createRequest(actor, { ...input, source: 'mcp' }); }, (r) => `${r.replayed ? 'Já existia' : 'Criada'}: ${r.request.clientCode}-${r.request.number} · ${r.request.title}`));

  server.registerTool('add_request_comment', {
    title: 'Comentar solicitação', description: 'Adiciona comentário público ou interno (interno só para credenciais da equipe Optsolv).',
    inputSchema: { requestId: uuid, body: z.string().min(1).max(5000), visibility: z.enum(['public', 'internal']).optional() },
  }, async ({ requestId, ...rest }) => run(() => addComment(actor, requestId, rest), (c) => `Comentário ${c.visibility} registrado.`));

  server.registerTool('create_delivery', {
    title: 'Registrar entrega', description: 'Cria uma entrega em rascunho num projeto autorizado, opcionalmente já vinculada a solicitações do mesmo cliente.',
    inputSchema: { projectId: uuid, title: z.string().min(2).max(140), summary: z.string().min(5).max(2000), details: z.string().max(10_000).optional(), requestIds: z.array(uuid).max(50).optional(), idempotencyKey: z.string().max(120).optional() },
  }, async (input) => run(() => createDelivery(actor, input), (d) => `Entrega "${d.title}" criada (${d.status}) com ${d.requests.length} solicitação(ões).`));

  server.registerTool('link_delivery_requests', {
    title: 'Vincular entrega a solicitações', description: 'Relação N:N; todas as solicitações precisam ser do mesmo cliente da entrega.',
    inputSchema: { deliveryId: uuid, requestIds: z.array(uuid).min(1).max(50) },
  }, async ({ deliveryId, requestIds }) => run(() => linkRequests(actor, deliveryId, requestIds), (d) => `Entrega agora vinculada a ${d.requests.length} solicitação(ões).`));

  server.registerTool('get_value_summary', {
    title: 'Resumo de valor', description: 'Indicadores calculados no banco (solicitações, entregas, evidências, tempo mediano) para cliente/projeto/período.',
    inputSchema: { clientId: uuid.optional(), projectId: uuid.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() },
  }, async ({ from, to, ...rest }) => run(() => metricsSummary(actor, { ...rest, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined }), (m) => `${m.totals.requestsCreated} criadas, ${m.totals.requestsConcluded} concluídas, ${m.totals.deliveriesPublished} entregas publicadas no período.`));

  server.registerTool('create_presentation', {
    title: 'Gerar apresentação', description: 'Gera e persiste uma apresentação executiva a partir dos dados autorizados do período. Abre na UI em /app/apresentacoes/{id}.',
    inputSchema: { clientId: uuid, projectIds: z.array(uuid).optional(), periodStart: z.string().datetime(), periodEnd: z.string().datetime(), title: z.string().max(140).optional() },
  }, async ({ periodStart, periodEnd, ...rest }) => run(() => generatePresentation(actor, { ...rest, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd) }), (p) => `Apresentação "${p.title}" gerada com ${p.slides.length} slides (id ${p.id}).`));

  return server;
}
