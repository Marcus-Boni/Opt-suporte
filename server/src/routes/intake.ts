import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { commitWhatsApp, previewWhatsApp } from '../services/intake.js';
import { REQUEST_CATEGORIES, REQUEST_PRIORITIES } from '../services/requests.js';

export const intakeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/intake/whatsapp-preview', {
    schema: {
      tags: ['intake'], description: 'Transforma mensagens coladas em sugestões revisáveis (modo demo determinístico, sem IA externa). Não grava nada.',
      body: z.object({ clientId: z.string().uuid(), projectId: z.string().uuid().optional(), text: z.string().min(1).max(50_000) }),
    },
  }, async (r) => previewWhatsApp(r.actor, r.body));

  app.post('/intake/whatsapp-commit', {
    schema: {
      tags: ['intake'], description: 'Grava as sugestões confirmadas como solicitações com origem captura_whatsapp, preservando o texto original.',
      body: z.object({
        clientId: z.string().uuid(), projectId: z.string().uuid(), rawText: z.string().min(1).max(50_000),
        items: z.array(z.object({
          title: z.string().min(1).max(140), description: z.string().min(5).max(5000), category: z.enum(REQUEST_CATEGORIES), priority: z.enum(REQUEST_PRIORITIES),
          sender: z.string().max(80), sentAt: z.string().nullable().optional(), excerpt: z.string().max(5000),
        })).min(1).max(50),
      }),
    },
  }, async (r, reply) => reply.status(201).send(await commitWhatsApp(r.actor, r.body)));
};
