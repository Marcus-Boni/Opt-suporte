import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { metricsSummary } from '../services/metrics.js';

export const metricsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/metrics', {
    schema: { tags: ['metrics'], description: 'Indicadores calculados no banco para o escopo do ator e filtros informados (padrão: últimos 180 dias).', querystring: z.object({ clientId: z.string().uuid().optional(), projectId: z.string().uuid().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() }) },
  }, async (r) => metricsSummary(r.actor, r.query));
};
