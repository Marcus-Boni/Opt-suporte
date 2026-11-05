import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, jsonSchemaTransform, hasZodFastifySchemaValidationErrors, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from './env.js';
import { HttpError } from './lib/errors.js';
import { MAX_FILE_BYTES } from './lib/files.js';
import { actorFromSession, actorFromToken } from './auth/service.js';
import type { Actor } from './auth/actor.js';
import { authRoutes } from './routes/auth.js';
import { clientRoutes } from './routes/clients.js';
import { requestRoutes } from './routes/requests.js';
import { intakeRoutes } from './routes/intake.js';
import { deliveryRoutes } from './routes/deliveries.js';
import { metricsRoutes } from './routes/metrics.js';
import { presentationRoutes } from './routes/presentations.js';
import { accessRoutes } from './routes/access.js';

declare module 'fastify' {
  interface FastifyRequest { actor: Actor }
  interface FastifyContextConfig { public?: boolean }
}

export const SESSION_COOKIE = 'osx_session';

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? env.NODE_ENV !== 'test', bodyLimit: 1024 * 1024, trustProxy: (_addr, hop) => hop < env.TRUST_PROXY }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 5 } });
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Optsolv Suporte API',
        version: '1.0.0',
        description: 'API v1 da plataforma Optsolv Suporte. A interface web, a API pública e o servidor MCP usam exatamente esta camada de negócio e as mesmas regras de autorização por cliente (tenant). Dados de demonstração são fictícios.',
      },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', description: 'Credencial de agente/API (osk_...), criada em Acessos.' },
          cookieAuth: { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE, description: 'Sessão do navegador após POST /api/v1/auth/login.' },
        },
      },
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      tags: [
        { name: 'auth' }, { name: 'clients' }, { name: 'requests' }, { name: 'intake' }, { name: 'deliveries' }, { name: 'metrics' }, { name: 'presentations' }, { name: 'access' },
      ],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.addHook('onSend', async (_req, reply) => { reply.header('X-Content-Type-Options', 'nosniff'); });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      const retry = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
      if (error.status === 429 && retry) reply.header('Retry-After', String(retry));
      return reply.status(error.status).send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({ error: { code: 'validation', message: 'Dados inválidos.', details: error.validation.map((v) => ({ path: v.instancePath, message: v.message })) } });
    }
    if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.status(413).send({ error: { code: 'file_too_large', message: `Arquivo maior que ${MAX_FILE_BYTES / 1024 / 1024} MB.` } });
    }
    const err = error as { statusCode?: number; message?: string };
    const status = err.statusCode ?? 500;
    if (status >= 500) request.log.error(error);
    return reply.status(status).send({ error: { code: status >= 500 ? 'internal' : 'error', message: status >= 500 ? 'Erro interno. Tente novamente.' : err.message } });
  });

  app.get('/health', { config: { public: true }, schema: { hide: true } }, async () => ({ ok: true }));
  app.get('/openapi.json', { config: { public: true }, schema: { hide: true } }, async () => app.swagger());

  await app.register(async (v1) => {
    v1.addHook('onRequest', async (request) => {
      if (request.routeOptions.config.public) return;
      const auth = request.headers.authorization;
      let actor: Actor | null = null;
      if (auth?.startsWith('Bearer ')) actor = await actorFromToken(auth.slice(7).trim());
      else {
        const raw = request.cookies[SESSION_COOKIE];
        if (raw) {
          const unsigned = request.unsignCookie(raw);
          if (unsigned.valid && unsigned.value) actor = await actorFromSession(unsigned.value);
        }
      }
      if (!actor) throw new HttpError(401, 'unauthorized', 'Autenticação necessária.');
      request.actor = actor;
    });
    await v1.register(authRoutes);
    await v1.register(clientRoutes);
    await v1.register(requestRoutes);
    await v1.register(intakeRoutes);
    await v1.register(deliveryRoutes);
    await v1.register(metricsRoutes);
    await v1.register(presentationRoutes);
    await v1.register(accessRoutes);
  }, { prefix: '/api/v1' });

  return app;
}
