import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { login, logout, userProfile } from '../auth/service.js';
import { listClients } from '../services/clients.js';
import { SESSION_COOKIE } from '../app.js';
import { env } from '../env.js';
import { createLimiter } from '../lib/rate-limit.js';

const MSG = 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.';
// Senhas erradas por conta+IP (força bruta numa conta) e por IP (varredura de várias contas).
const perAccount = createLimiter(10, 15 * 60_000, MSG);
const perIp = createLimiter(30, 15 * 60_000, MSG);

const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax' as const, signed: true, secure: env.NODE_ENV === 'production', maxAge: 7 * 86_400 };

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/auth/login', {
    config: { public: true },
    schema: { tags: ['auth'], security: [], body: z.object({ email: z.string().email(), password: z.string().min(1) }) },
  }, async (request, reply) => {
    const key = `${request.ip}|${request.body.email.toLowerCase()}`;
    perIp.check(request.ip);
    perAccount.check(key);
    let session: Awaited<ReturnType<typeof login>>;
    try { session = await login(request.body.email, request.body.password); } catch (e) { perAccount.hit(key); perIp.hit(request.ip); throw e; }
    perAccount.reset(key);
    const { sessionId, actor, user } = session;
    reply.setCookie(SESSION_COOKIE, sessionId, cookieOpts);
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId }, clients: await listClients(actor) };
  });

  app.post('/auth/logout', { schema: { tags: ['auth'] } }, async (request, reply) => {
    const raw = request.cookies[SESSION_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : null;
    if (unsigned?.valid && unsigned.value) await logout(unsigned.value);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/auth/me', { schema: { tags: ['auth'], description: 'Identidade autenticada (sessão ou credencial) e clientes visíveis.' } }, async (request) => {
    const actor = request.actor;
    return { actor: { kind: actor.kind, id: actor.id, label: actor.label, role: actor.role, clientIds: actor.clientIds }, user: await userProfile(actor), clients: await listClients(actor) };
  });
};
