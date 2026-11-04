import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { deletePresentation, generatePresentation, getPresentation, listPresentations, updatePresentation } from '../services/presentations.js';

export const presentationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/presentations', { schema: { tags: ['presentations'], description: 'Clientes só veem apresentações compartilhadas.', querystring: z.object({ clientId: z.string().uuid().optional() }) } }, async (r) => listPresentations(r.actor, r.query.clientId));

  app.post('/presentations', {
    schema: { tags: ['presentations'], description: 'Gera uma apresentação persistida a partir dos dados do período (cliente + projetos + datas).', body: z.object({ clientId: z.string().uuid(), projectIds: z.array(z.string().uuid()).optional(), periodStart: z.coerce.date(), periodEnd: z.coerce.date(), title: z.string().max(140).optional() }) },
  }, async (r, reply) => reply.status(201).send(await generatePresentation(r.actor, r.body)));

  app.get('/presentations/:id', { schema: { tags: ['presentations'], params: z.object({ id: z.string().uuid() }) } }, async (r) => getPresentation(r.actor, r.params.id));

  app.patch('/presentations/:id', {
    schema: { tags: ['presentations'], description: 'Edita título/narrativa dos slides e o status (compartilhada = visível no portal do cliente).', params: z.object({ id: z.string().uuid() }), body: z.object({ title: z.string().max(140).optional(), status: z.enum(['rascunho', 'compartilhada']).optional(), slides: z.array(z.object({ id: z.string(), title: z.string().max(140).optional(), body: z.string().max(4000).optional() })).max(40).optional() }) },
  }, async (r) => updatePresentation(r.actor, r.params.id, r.body));

  app.delete('/presentations/:id', { schema: { tags: ['presentations'], params: z.object({ id: z.string().uuid() }) } }, async (r, reply) => { await deletePresentation(r.actor, r.params.id); return reply.status(204).send(); });
};
