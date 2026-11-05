import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ANALYSIS_MODE_PATTERN, commitWhatsApp, previewWhatsApp } from '../services/intake.js';
import { REQUEST_CATEGORIES, REQUEST_PRIORITIES } from '../services/requests.js';
import { createLimiter } from '../lib/rate-limit.js';

const previewLimit = createLimiter(20, 10 * 60_000, 'Limite de análises atingido (20 a cada 10 minutos). Aguarde alguns minutos e tente de novo.');

export const intakeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/intake/whatsapp-preview', {
    schema: {
      tags: ['intake'], description: 'Transforma mensagens coladas em sugestões revisáveis. Usa IA (Microsoft Foundry) quando configurada, com fallback para heurísticas locais; a resposta informa o modo usado. Não grava nada.',
      body: z.object({ clientId: z.string().uuid(), projectId: z.string().uuid().optional(), text: z.string().min(1).max(50_000) }),
    },
  }, async (r) => {
    // Cada análise pode chamar o modelo: limita por identidade para controlar custo e abuso.
    previewLimit.check(r.actor.id);
    previewLimit.hit(r.actor.id);
    return previewWhatsApp(r.actor, r.body);
  });

  app.post('/intake/whatsapp-commit', {
    schema: {
      tags: ['intake'], description: 'Grava as sugestões confirmadas como solicitações com origem captura_whatsapp, preservando o texto original.',
      body: z.object({
        clientId: z.string().uuid(), projectId: z.string().uuid(), rawText: z.string().min(1).max(50_000),
        items: z.array(z.object({
          title: z.string().min(1).max(140), description: z.string().min(5).max(5000), category: z.enum(REQUEST_CATEGORIES), priority: z.enum(REQUEST_PRIORITIES),
          sender: z.string().max(80), sentAt: z.string().nullable().optional(), excerpt: z.string().max(5000),
        })).min(1).max(50),
        analysisMode: z.string().regex(ANALYSIS_MODE_PATTERN).optional().describe('Modo devolvido pelo preview (heuristica ou ia:<implantação>), registrado na origem.'),
      }),
    },
  }, async (r, reply) => reply.status(201).send(await commitWhatsApp(r.actor, r.body)));
};
