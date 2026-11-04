import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createClient, createProject, getClient, listClients, listProjects, listTeam } from '../services/clients.js';

export const clientRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/clients', { schema: { tags: ['clients'], description: 'Clientes visíveis ao ator (admin: todos; colaborador: vínculos; cliente: o próprio).' } }, async (r) => listClients(r.actor));

  app.post('/clients', {
    schema: { tags: ['clients'], description: 'Cria cliente (somente admin).', body: z.object({ name: z.string().min(2).max(80), shortCode: z.string().min(1).max(4).optional(), segment: z.string().max(80).optional(), description: z.string().max(500).optional() }) },
  }, async (r, reply) => reply.status(201).send(await createClient(r.actor, r.body)));

  app.get('/clients/:id', { schema: { tags: ['clients'], params: z.object({ id: z.string().uuid() }) } }, async (r) => getClient(r.actor, r.params.id));

  app.get('/projects', { schema: { tags: ['clients'], querystring: z.object({ clientId: z.string().uuid().optional() }) } }, async (r) => listProjects(r.actor, r.query.clientId));

  app.post('/projects', {
    schema: { tags: ['clients'], body: z.object({ clientId: z.string().uuid(), name: z.string().min(2).max(80), code: z.string().min(1).max(12).optional(), description: z.string().max(500).optional() }) },
  }, async (r, reply) => reply.status(201).send(await createProject(r.actor, r.body)));

  app.get('/team', { schema: { tags: ['clients'], description: 'Equipe interna Optsolv (para atribuição de responsáveis).' } }, async (r) => listTeam(r.actor));
};
