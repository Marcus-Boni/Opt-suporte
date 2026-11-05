/**
 * Login com Microsoft Entra ID contra um provedor OIDC simulado (HTTP de verdade, chaves RSA, PKCE conferido).
 * Cobre o fluxo completo, as recusas (tenant, domínio, conta inativa, state, consentimento) e a gestão de acesso.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { eq } from 'drizzle-orm';
import { app, clientBySlug, loginCookie } from './helpers.js';
import { db, pool, schema } from '../src/db/index.js';
import { env } from '../src/env.js';

const TENANT = '11111111-2222-3333-4444-555555555555';
const CLIENT_ID = 'app-optsolv-suporte';
type Person = { oid: string; email: string; name: string; tid?: string };

let api: Awaited<ReturnType<typeof app>>;
let admin: string;
const idp = Fastify();
let base = '';
const codes = new Map<string, { person: Person; nonce: string; challenge: string }>();
const original = { ...env };

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  idp.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_r, body, done) => done(null, Object.fromEntries(new URLSearchParams(body as string))));
  idp.get('/tenant/v2.0/.well-known/openid-configuration', async () => ({
    issuer: `${base}/tenant/v2.0`, authorization_endpoint: `${base}/authorize`, token_endpoint: `${base}/token`, jwks_uri: `${base}/keys`,
    response_types_supported: ['code'], subject_types_supported: ['pairwise'], id_token_signing_alg_values_supported: ['RS256'],
  }));
  idp.get('/keys', async () => ({ keys: [jwk] }));
  idp.post('/token', async (req, reply) => {
    const b = req.body as Record<string, string>;
    const hit = codes.get(b.code);
    const challenge = createHash('sha256').update(b.code_verifier ?? '').digest('base64url');
    if (!hit || hit.challenge !== challenge || b.client_id !== CLIENT_ID || b.client_secret !== 'segredo') return reply.status(400).send({ error: 'invalid_grant' });
    codes.delete(b.code);
    const { person } = hit;
    const idToken = await new SignJWT({ oid: person.oid, tid: person.tid ?? TENANT, email: person.email, preferred_username: person.email, name: person.name, nonce: hit.nonce })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(`${base}/tenant/v2.0`).setAudience(CLIENT_ID).setSubject(`sub-${person.oid}`)
      .setIssuedAt().setExpirationTime('5m').sign(privateKey);
    return { access_token: 'at', token_type: 'Bearer', expires_in: 300, id_token: idToken };
  });
  base = (await idp.listen({ port: 0, host: '127.0.0.1' })).replace('[::1]', '127.0.0.1');
  api = await app();
  admin = (await loginCookie(api, 'admin@optsolv.demo')).cookie;
});
afterEach(() => { Object.assign(env, original, { ENTRA_ALLOWED_DOMAINS: [...original.ENTRA_ALLOWED_DOMAINS], EMERGENCY_ADMIN_EMAILS: [...original.EMERGENCY_ADMIN_EMAILS] }); });
afterAll(async () => { await api.close(); await idp.close(); await pool.end(); });

function enableEntra() {
  Object.assign(env, { ENTRA_TENANT_ID: TENANT, ENTRA_CLIENT_ID: CLIENT_ID, ENTRA_CLIENT_SECRET: 'segredo', ENTRA_AUTHORITY: `${base}/tenant/v2.0` });
}

/** Ida até a Microsoft e volta: a "Microsoft" autentica `person` e devolve o código ao callback. */
async function signIn(person: Person, opts: { next?: string; tamperState?: boolean; dropCookie?: boolean } = {}) {
  const start = await api.inject({ method: 'GET', url: `/api/v1/auth/entra/login${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ''}` });
  expect(start.statusCode).toBe(302);
  const authorize = new URL(start.headers.location as string);
  expect(authorize.origin + authorize.pathname).toBe(`${base}/authorize`);
  expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
  const flow = start.cookies.find((c) => c.name === 'osx_entra')!;
  const code = randomUUID();
  codes.set(code, { person, nonce: authorize.searchParams.get('nonce')!, challenge: authorize.searchParams.get('code_challenge')! });
  const state = opts.tamperState ? 'outro-state' : authorize.searchParams.get('state');
  const back = await api.inject({ method: 'GET', url: `/api/v1/auth/entra/callback?code=${code}&state=${state}`, headers: opts.dropCookie ? {} : { cookie: `osx_entra=${flow.value}` } });
  expect(back.statusCode).toBe(302);
  const session = back.cookies.find((c) => c.name === 'osx_session' && c.value);
  return { location: back.headers.location as string, cookie: session ? `osx_session=${session.value}` : undefined };
}
const person = (p: Partial<Person> = {}): Person => ({ oid: randomUUID(), email: `pessoa.${Date.now()}${Math.floor(Math.random() * 1e4)}@optsolv.com.br`, name: 'Pessoa Teste', ...p });
const me = async (cookie: string) => (await api.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } })).json();

describe('login com Microsoft Entra ID', () => {
  it('sem configuração, o botão some e a rota volta ao login', async () => {
    expect((await api.inject({ method: 'GET', url: '/api/v1/auth/providers' })).json()).toEqual({ entra: false });
    const r = await api.inject({ method: 'GET', url: '/api/v1/auth/entra/login' });
    expect(r.headers.location).toBe('http://localhost:5173/entrar?erro=indisponivel');
  });

  it('primeiro acesso de alguém da Optsolv cria colaborador sem clientes e abre sessão', async () => {
    enableEntra();
    expect((await api.inject({ method: 'GET', url: '/api/v1/auth/providers' })).json()).toEqual({ entra: true });
    const p = person({ name: 'Ana Souza' });
    const { location, cookie } = await signIn(p, { next: '/app/solicitacoes' });
    expect(location).toBe('http://localhost:5173/app/solicitacoes');
    const who = await me(cookie!);
    expect(who.actor).toMatchObject({ role: 'colaborador_optsolv', label: 'Ana Souza', clientIds: [] });
    const [row] = await db.select().from(schema.users).where(eq(schema.users.email, p.email));
    expect(row.entraOid).toBe(p.oid);
    // A segunda entrada usa o mesmo vínculo (oid), sem duplicar a pessoa.
    await signIn(p);
    expect(await db.select().from(schema.users).where(eq(schema.users.email, p.email))).toHaveLength(1);
  });

  it('conta existente é reconhecida pelo e-mail e mantém o papel (admin continua admin)', async () => {
    enableEntra();
    env.ENTRA_ALLOWED_DOMAINS.push('optsolv.demo');
    const { cookie } = await signIn(person({ email: 'admin@optsolv.demo', name: 'Helena (Entra)' }));
    expect((await me(cookie!)).actor).toMatchObject({ role: 'admin_optsolv', clientIds: 'all', label: 'Helena Prado' });
  });

  it('recusa outro tenant, outro domínio, conta desativada e e-mail já vinculado a outra pessoa', async () => {
    enableEntra();
    expect((await signIn(person({ tid: 'outro-tenant' }))).location).toBe('http://localhost:5173/entrar?erro=tenant');
    expect((await signIn(person({ email: 'alguem@gmail.com' }))).location).toBe('http://localhost:5173/entrar?erro=dominio');

    const p = person();
    await signIn(p);
    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.email, p.email));
    const off = await signIn(p);
    expect(off.location).toBe('http://localhost:5173/entrar?erro=inativo');
    expect(off.cookie).toBeUndefined();

    const linked = person();
    await signIn(linked);
    expect((await signIn({ ...linked, oid: randomUUID() })).location).toBe('http://localhost:5173/entrar?erro=conta');
  });

  it('protege o fluxo: state adulterado, cookie ausente, retorno com erro e destino externo', async () => {
    enableEntra();
    expect((await signIn(person(), { tamperState: true })).location).toBe('http://localhost:5173/entrar?erro=falha');
    expect((await signIn(person(), { dropCookie: true })).location).toBe('http://localhost:5173/entrar?erro=sessao');
    const consent = await api.inject({ method: 'GET', url: '/api/v1/auth/entra/callback?error=consent_required&error_description=AADSTS65001%3A+The+user+or+administrator+has+not+consented' });
    expect(consent.headers.location).toBe('http://localhost:5173/entrar?erro=consentimento');
    expect((await signIn(person(), { next: '//evil.example/app' })).location).toBe('http://localhost:5173/app');
  });

  it('com o Entra ligado, conta Optsolv não entra com senha; admin de emergência entra', async () => {
    const email = `emergencia.${Date.now()}@optsolv.com.br`;
    const created = await api.inject({ method: 'POST', url: '/api/v1/users', headers: { cookie: admin }, payload: { name: 'Admin Emergência', email, password: 'Senha-Forte-2026!', role: 'admin_optsolv' } });
    expect(created.statusCode).toBe(201);
    enableEntra();
    const blocked = await api.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Senha-Forte-2026!' } });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe('use_microsoft');
    env.EMERGENCY_ADMIN_EMAILS.push(email);
    expect((await api.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: 'Senha-Forte-2026!' } })).statusCode).toBe(200);
    // Clientes do portal (outros domínios) seguem com senha.
    expect((await loginCookie(api, 'joao@cidadeengenharia.demo')).cookie).toBeTruthy();
  });
});

describe('gestão de acesso da equipe', () => {
  it('admin libera clientes e promove; vale na próxima requisição; ninguém se rebaixa sozinho', async () => {
    enableEntra();
    const p = person();
    const { cookie } = await signIn(p);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.email, p.email));
    const cidade = await clientBySlug('cidade-engenharia');

    const grant = await api.inject({ method: 'PATCH', url: `/api/v1/users/${row.id}`, headers: { cookie: admin }, payload: { clientIds: [cidade.id] } });
    expect(grant.statusCode).toBe(200);
    expect((await me(cookie!)).actor.clientIds).toEqual([cidade.id]);

    await api.inject({ method: 'PATCH', url: `/api/v1/users/${row.id}`, headers: { cookie: admin }, payload: { role: 'admin_optsolv' } });
    expect((await me(cookie!)).actor).toMatchObject({ role: 'admin_optsolv', clientIds: 'all' });

    const users = (await api.inject({ method: 'GET', url: '/api/v1/users', headers: { cookie: admin } })).json();
    expect(users.find((u: { id: string }) => u.id === row.id).microsoft).toBe(true);

    const adminId = (await me(admin)).actor.id;
    expect((await api.inject({ method: 'PATCH', url: `/api/v1/users/${adminId}`, headers: { cookie: admin }, payload: { role: 'colaborador_optsolv' } })).statusCode).toBe(400);
    const [joao] = await db.select().from(schema.users).where(eq(schema.users.email, 'joao@cidadeengenharia.demo'));
    expect((await api.inject({ method: 'PATCH', url: `/api/v1/users/${joao.id}`, headers: { cookie: admin }, payload: { role: 'admin_optsolv' } })).statusCode).toBe(400);
    expect((await api.inject({ method: 'PATCH', url: `/api/v1/users/${row.id}`, headers: { cookie }, payload: { role: 'colaborador_optsolv' } })).statusCode).toBe(400);
    expect((await api.inject({ method: 'PATCH', url: `/api/v1/users/${row.id}`, headers: { cookie: admin }, payload: { role: 'colaborador_optsolv' } })).statusCode).toBe(200);
    expect((await me(cookie!)).actor).toMatchObject({ role: 'colaborador_optsolv', clientIds: [cidade.id] });
  });
});
