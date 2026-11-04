import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { login, logout, userProfile } from '../auth/service.js';
import { listClients } from '../services/clients.js';
import { SESSION_COOKIE } from '../app.js';
import { env } from '../env.js';
import { HttpError } from '../lib/errors.js';

// shortcut: contador em memória por processo, suficiente para uma instância; trocar por Redis ao escalar horizontalmente.
const attempts = new Map<string, { n: number; until: number }>();
const MAX_ATTEMPTS = 10, WINDOW_MS = 15 * 60_000;
function checkAttempts(key: string) {
  const a = attempts.get(key);
  if (a && a.n >= MAX_ATTEMPTS && Date.now() < a.until) throw new HttpError(429, 'too_many_attempts', 'Muitas tentativas. Aguarde 15 minutos.');
}
function recordFailure(key: string) {
  const a = attempts.get(key);
  attempts.set(key, a && Date.now() < a.until ? { n: a.n + 1, until: a.until } : { n: 1, until: Date.now() + WINDOW_MS });
}

const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax' as const, signed: true, secure: env.NODE_ENV === 'production', maxAge: 7 * 86_400 };

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/auth/login', {
    config: { public: true },
    schema: { tags: ['auth'], security: [], body: z.object({ email: z.string().email(), password: z.string().min(1) }) },
  }, async (request, reply) => {
    const key = `${request.ip}|${request.body.email.toLowerCase()}`;
    checkAttempts(key);
    let session: Awaited<ReturnType<typeof login>>;
    try { session = await login(request.body.email, request.body.password); } catch (e) { recordFailure(key); throw e; }
    attempts.delete(key);
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
