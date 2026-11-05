import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { addComment, deleteComment, createRequest, createRequestLimit, getRequest, listRequests, recordAttachmentEvent, requestForAttachment, updateRequest, REQUEST_CATEGORIES, REQUEST_PRIORITIES, REQUEST_SOURCES, REQUEST_STATUSES } from '../services/requests.js';
import { openAttachment, storeUpload } from '../lib/files.js';
import { badRequest } from '../lib/errors.js';
import { isInternal } from '../auth/actor.js';

const status = z.enum(REQUEST_STATUSES);
const category = z.enum(REQUEST_CATEGORIES);
const priority = z.enum(REQUEST_PRIORITIES);

export const requestRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/requests', {
    schema: {
      tags: ['requests'], description: 'Lista paginada, sempre restrita aos clientes do ator. `status` aceita vários valores separados por vírgula.',
      querystring: z.object({
        clientId: z.string().uuid().optional(), projectId: z.string().uuid().optional(), status: z.string().optional(), category: category.optional(), priority: priority.optional(),
        source: z.enum(REQUEST_SOURCES).optional(), assigneeUserId: z.string().uuid().optional(), unassigned: z.coerce.boolean().optional(), open: z.coerce.boolean().optional(),
        search: z.string().max(120).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional(),
      }),
    },
  }, async (r) => {
    const statuses = r.query.status ? r.query.status.split(',').map((s) => status.parse(s.trim())) : undefined;
    return listRequests(r.actor, { ...r.query, status: statuses });
  });

  app.post('/requests', {
    schema: {
      tags: ['requests'], description: 'Cria solicitação. O cliente é derivado do projeto e validado contra o escopo do ator. Aceita header Idempotency-Key. `authorLabel`: a equipe informa o remetente; uma credencial de cliente (ex.: widget) informa quem reportou, gravado como "Nome (via Agente: credencial)". Limite: 120 novas a cada 10 minutos por identidade (429 com Retry-After).',
      headers: z.object({ 'idempotency-key': z.string().max(120).optional() }),
      body: z.object({
        projectId: z.string().uuid(), title: z.string().max(140).optional(), description: z.string().min(5).max(5000),
        category: category.optional(), priority: priority.optional(), source: z.enum(['portal', 'admin', 'api', 'mcp']).optional(), authorLabel: z.string().max(80).optional(),
      }),
    },
  }, async (r, reply) => {
    const source = r.body.source ?? (r.actor.kind === 'credential' ? 'api' : isInternal(r.actor) ? 'admin' : 'portal');
    if (!isInternal(r.actor) && source !== 'portal' && r.actor.kind !== 'credential') throw badRequest('Origem inválida.');
    createRequestLimit.check(r.actor.id);
    createRequestLimit.hit(r.actor.id);
    const { request, replayed } = await createRequest(r.actor, { ...r.body, source, idempotencyKey: r.headers['idempotency-key'] });
    return reply.status(replayed ? 200 : 201).send(request);
  });

  app.get('/requests/:id', { schema: { tags: ['requests'], params: z.object({ id: z.string().uuid() }) } }, async (r) => getRequest(r.actor, r.params.id));

  app.patch('/requests/:id', {
    schema: {
      tags: ['requests'], description: 'Equipe: status, responsável, categoria, prioridade, título e descrição. Cliente: apenas reabrir (status=nova + reason).',
      params: z.object({ id: z.string().uuid() }),
      body: z.object({
        title: z.string().max(140).optional(), description: z.string().max(5000).optional(), category: category.optional(), priority: priority.optional(), status: status.optional(),
        assigneeUserId: z.string().uuid().nullable().optional(), reason: z.string().max(500).optional(), note: z.string().max(500).optional(),
      }),
    },
  }, async (r) => updateRequest(r.actor, r.params.id, r.body));

  app.post('/requests/:id/comments', {
    schema: { tags: ['requests'], description: 'Comentário público ou interno. Clientes sempre criam comentários públicos.', params: z.object({ id: z.string().uuid() }), body: z.object({ body: z.string().min(1).max(5000), visibility: z.enum(['public', 'internal']).optional() }) },
  }, async (r, reply) => reply.status(201).send(await addComment(r.actor, r.params.id, r.body)));

  app.delete('/requests/:id/comments/:commentId', {
    schema: { tags: ['requests'], description: 'Desfaz um comentário próprio nos primeiros 10 minutos.', params: z.object({ id: z.string().uuid(), commentId: z.string().uuid() }) },
  }, async (r, reply) => { await deleteComment(r.actor, r.params.id, r.params.commentId); return reply.status(204).send(); });

  app.post('/requests/:id/attachments', {
    schema: { tags: ['requests'], description: 'Upload multipart (campo `file`), até 5 MB; imagens, PDF, texto, CSV, XLSX ou DOCX.', params: z.object({ id: z.string().uuid() }), consumes: ['multipart/form-data'] },
  }, async (r, reply) => {
    const target = await requestForAttachment(r.actor, r.params.id);
    const file = await r.file();
    if (!file) throw badRequest('Envie um arquivo no campo "file".');
    const att = await storeUpload(target.clientId, file, r.actor.label, { requestId: target.id });
    await recordAttachmentEvent(r.actor, target.id, att.fileName);
    return reply.status(201).send(att);
  });

  app.get('/attachments/:id', { schema: { tags: ['requests'], description: 'Download autorizado pelo escopo do cliente.', params: z.object({ id: z.string().uuid() }) } }, async (r, reply) => {
    const { meta, data, inline } = await openAttachment(r.actor, r.params.id);
    const etag = meta.sha256 ? `"${meta.sha256}"` : undefined;
    // Conteúdo autorizado: cache só no navegador de quem baixou, revalidado pelo hash (304 sem reenviar os bytes).
    reply.header('Cache-Control', 'private, no-cache');
    if (etag) {
      reply.header('ETag', etag);
      if (r.headers['if-none-match'] === etag) return reply.status(304).send();
    }
    const ascii = meta.fileName.replace(/[^\x20-\x7e]/g, '_');
    reply.header('Content-Type', meta.mimeType);
    reply.header('Content-Length', data.length);
    reply.header('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`);
    return reply.send(data);
  });
};
