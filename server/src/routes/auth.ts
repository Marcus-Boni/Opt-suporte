import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { login, logout, userProfile } from '../auth/service.js';
import { listClients } from '../services/clients.js';
import { SESSION_COOKIE } from '../app.js';
import { env } from '../env.js';
import { createLimiter } from '../lib/rate-limit.js';
import { entraEnabled } from '../auth/entra-config.js';
import { EntraError, finishEntraLogin, startEntraLogin, type EntraFlow } from '../auth/entra.js';

const MSG = 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.';
// Senhas erradas por conta+IP (força bruta numa conta) e por IP (varredura de várias contas).
const perAccount = createLimiter(10, 15 * 60_000, MSG);
const perIp = createLimiter(30, 15 * 60_000, MSG);

const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax' as const, signed: true, secure: env.NODE_ENV === 'production', maxAge: 7 * 86_400 };
// Estado do login com a Microsoft (PKCE, state, nonce) entre a ida e a volta: assinado, 10 min, só nas rotas do Entra.
// SameSite=Lax: a volta da Microsoft é navegação de topo (GET), então o cookie acompanha.
const FLOW_COOKIE = 'osx_entra';
const flowCookieOpts = { ...cookieOpts, path: '/api/v1/auth/entra', maxAge: 600 };
/** Só caminhos internos da própria interface (nada de //host ou esquema): evita redirecionamento aberto. */
const safeNext = (n?: string) => (n && /^\/(app|portal)(\/|$|\?)/.test(n) && !n.includes('//') ? n : '/app');
const toLogin = (reason: string) => `${env.APP_URL}/entrar?erro=${reason}`;

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

  app.get('/auth/providers', { config: { public: true }, schema: { tags: ['auth'], security: [], description: 'Métodos de login disponíveis neste ambiente.' } },
    async () => ({ entra: entraEnabled() }));

  app.get('/auth/entra/login', {
    config: { public: true },
    schema: { tags: ['auth'], security: [], description: 'Inicia o login da equipe com a Microsoft (redireciona para o Entra ID).', querystring: z.object({ next: z.string().max(300).optional() }) },
  }, async (request, reply) => {
    if (!entraEnabled()) return reply.redirect(toLogin('indisponivel'));
    try {
      const { url, flow } = await startEntraLogin(safeNext(request.query.next));
      reply.setCookie(FLOW_COOKIE, JSON.stringify(flow), flowCookieOpts);
      return reply.redirect(url);
    } catch (e) {
      return reply.redirect(toLogin(e instanceof EntraError ? e.reason : 'falha'));
    }
  });

  app.get('/auth/entra/callback', { config: { public: true }, schema: { hide: true } }, async (request, reply) => {
    reply.clearCookie(FLOW_COOKIE, { path: flowCookieOpts.path });
    const query = request.query as Record<string, string | undefined>;
    if (query.error) {
      // AADSTS65001/90094: o tenant exige consentimento de administrador para este app.
      const reason = /AADSTS(65001|90094|90008)/.test(query.error_description ?? '') ? 'consentimento' : query.error === 'access_denied' ? 'cancelado' : 'falha';
      return reply.redirect(toLogin(reason));
    }
    const raw = request.cookies[FLOW_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : null;
    let flow: EntraFlow;
    try { flow = JSON.parse(unsigned?.valid && unsigned.value ? unsigned.value : ''); } catch { return reply.redirect(toLogin('sessao')); }
    // A URL de volta é montada da configuração, não do Host da requisição.
    const callback = new URL(env.ENTRA_REDIRECT_URI);
    callback.search = new URL(request.url, 'http://local').search;
    try {
      const { sessionId } = await finishEntraLogin(callback, flow);
      reply.setCookie(SESSION_COOKIE, sessionId, cookieOpts);
      return reply.redirect(`${env.APP_URL}${flow.next}`);
    } catch (e) {
      if (!(e instanceof EntraError)) request.log.error(e);
      return reply.redirect(toLogin(e instanceof EntraError ? e.reason : 'falha'));
    }
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
