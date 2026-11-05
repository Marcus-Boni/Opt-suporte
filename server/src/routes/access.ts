import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createCredential, createUser, listAudit, listCredentials, listUsers, revokeCredential, setUserActive } from '../services/access.js';

const role = z.enum(['admin_optsolv', 'colaborador_optsolv', 'cliente']);

export const accessRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/users', { schema: { tags: ['access'], description: 'Somente admin.' } }, async (r) => listUsers(r.actor));
  app.post('/users', {
    schema: { tags: ['access'], body: z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(12).max(100), role, clientId: z.string().uuid().optional(), clientIds: z.array(z.string().uuid()).optional() }) },
  }, async (r, reply) => reply.status(201).send(await createUser(r.actor, r.body)));
  app.patch('/users/:id', { schema: { tags: ['access'], params: z.object({ id: z.string().uuid() }), body: z.object({ isActive: z.boolean() }) } }, async (r) => setUserActive(r.actor, r.params.id, r.body.isActive));

  app.get('/credentials', { schema: { tags: ['access'], description: 'Credenciais de API/MCP (somente admin). O token só é exibido na criação.' } }, async (r) => listCredentials(r.actor));
  app.post('/credentials', { schema: { tags: ['access'], body: z.object({ name: z.string().min(2).max(80), role, clientId: z.string().uuid().optional() }) } }, async (r, reply) => reply.status(201).send(await createCredential(r.actor, r.body)));
  app.delete('/credentials/:id', { schema: { tags: ['access'], params: z.object({ id: z.string().uuid() }) } }, async (r) => revokeCredential(r.actor, r.params.id));

  app.get('/audit', { schema: { tags: ['access'], querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }) } }, async (r) => listAudit(r.actor, r.query.limit));
};
