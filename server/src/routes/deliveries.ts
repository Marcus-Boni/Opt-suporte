import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { addEvidence, createDelivery, deliveryForAttachment, getDelivery, linkRequests, listDeliveries, unlinkRequest, updateDelivery, EVIDENCE_KINDS } from '../services/deliveries.js';
import { storeUpload } from '../lib/files.js';
import { badRequest } from '../lib/errors.js';

export const deliveryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/deliveries', {
    schema: { tags: ['deliveries'], description: 'Clientes só veem entregas publicadas.', querystring: z.object({ clientId: z.string().uuid().optional(), projectId: z.string().uuid().optional(), status: z.enum(['rascunho', 'publicada']).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional() }) },
  }, async (r) => listDeliveries(r.actor, r.query));

  app.post('/deliveries', {
    schema: {
      tags: ['deliveries'], headers: z.object({ 'idempotency-key': z.string().max(120).optional() }),
      body: z.object({ projectId: z.string().uuid(), title: z.string().min(2).max(140), summary: z.string().min(5).max(2000), details: z.string().max(10_000).optional(), deliveredAt: z.coerce.date().optional(), requestIds: z.array(z.string().uuid()).max(50).optional() }),
    },
  }, async (r, reply) => reply.status(201).send(await createDelivery(r.actor, { ...r.body, idempotencyKey: r.headers['idempotency-key'] })));

  app.get('/deliveries/:id', { schema: { tags: ['deliveries'], params: z.object({ id: z.string().uuid() }) } }, async (r) => getDelivery(r.actor, r.params.id));

  app.patch('/deliveries/:id', {
    schema: { tags: ['deliveries'], description: 'Edita ou publica (status=publicada) uma entrega.', params: z.object({ id: z.string().uuid() }), body: z.object({ title: z.string().min(2).max(140).optional(), summary: z.string().min(5).max(2000).optional(), details: z.string().max(10_000).nullable().optional(), deliveredAt: z.coerce.date().optional(), status: z.enum(['rascunho', 'publicada']).optional() }) },
  }, async (r) => updateDelivery(r.actor, r.params.id, r.body));

  app.post('/deliveries/:id/requests', {
    schema: { tags: ['deliveries'], description: 'Vincula solicitações (N:N). Todas precisam pertencer ao mesmo cliente da entrega.', params: z.object({ id: z.string().uuid() }), body: z.object({ requestIds: z.array(z.string().uuid()).min(1).max(50) }) },
  }, async (r) => linkRequests(r.actor, r.params.id, r.body.requestIds));

  app.delete('/deliveries/:id/requests/:requestId', { schema: { tags: ['deliveries'], params: z.object({ id: z.string().uuid(), requestId: z.string().uuid() }) } }, async (r) => unlinkRequest(r.actor, r.params.id, r.params.requestId));

  app.post('/deliveries/:id/evidences', {
    schema: {
      tags: ['deliveries'], description: 'Evidência/benefício: observado, esperado ou medido (medido exige valor numérico).', params: z.object({ id: z.string().uuid() }),
      body: z.object({ kind: z.enum(EVIDENCE_KINDS), title: z.string().min(2).max(140), description: z.string().max(2000).optional(), metricValue: z.number().nullable().optional(), metricUnit: z.string().max(40).optional(), sourceLabel: z.string().max(140).optional(), linkUrl: z.string().url().max(500).optional(), attachmentId: z.string().uuid().optional() }),
    },
  }, async (r, reply) => reply.status(201).send(await addEvidence(r.actor, r.params.id, r.body)));

  app.post('/deliveries/:id/attachments', {
    schema: { tags: ['deliveries'], description: 'Upload de evidência em arquivo (campo `file`, até 5 MB).', params: z.object({ id: z.string().uuid() }), consumes: ['multipart/form-data'] },
  }, async (r, reply) => {
    const target = await deliveryForAttachment(r.actor, r.params.id);
    const file = await r.file();
    if (!file) throw badRequest('Envie um arquivo no campo "file".');
    return reply.status(201).send(await storeUpload(target.clientId, file, r.actor.label, { deliveryId: target.id }));
  });
};
