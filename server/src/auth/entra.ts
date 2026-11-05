/**
 * Login da equipe Optsolv com Microsoft Entra ID: OpenID Connect, fluxo de código com PKCE, nonce e state,
 * feito no servidor (o navegador nunca vê tokens). Só o tenant configurado e os domínios permitidos entram.
 * Primeiro acesso cria a pessoa como colaborador sem clientes (menor privilégio): um admin libera depois.
 */
import * as oidc from 'openid-client';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { env } from '../env.js';
import { audit } from '../services/audit.js';
import { hashPassword, randomToken } from './password.js';
import { actorFromUser, createSession } from './service.js';
import { isEntraDomain } from './entra-config.js';

/** `link`: id da pessoa logada com senha que pediu para vincular a conta Microsoft (vínculo explícito). */
export type EntraFlow = { verifier: string; state: string; nonce: string; next: string; link?: string };
/** Motivo de recusa, mostrado na tela de login (/entrar?erro=…). */
export class EntraError extends Error { constructor(public reason: 'indisponivel' | 'tenant' | 'convidado' | 'dominio' | 'inativo' | 'conta' | 'vincular' | 'sessao' | 'falha') { super(reason); } }

let cached: { key: string; config: Promise<oidc.Configuration> } | undefined;
function configuration() {
  const authority = env.ENTRA_AUTHORITY || `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`;
  const key = `${authority}|${env.ENTRA_CLIENT_ID}`;
  if (cached?.key !== key) {
    // http só para o provedor simulado dos testes; a Microsoft é sempre https.
    const options = authority.startsWith('http://') ? { execute: [oidc.allowInsecureRequests] } : undefined;
    const config = oidc.discovery(new URL(authority), env.ENTRA_CLIENT_ID, undefined, oidc.ClientSecretPost(env.ENTRA_CLIENT_SECRET), options);
    cached = { key, config };
    config.catch(() => { if (cached?.config === config) cached = undefined; }); // falha de rede não fica em cache
  }
  return cached.config;
}

export async function startEntraLogin(next: string, link?: string) {
  const config = await configuration().catch(() => { throw new EntraError('indisponivel'); });
  const flow: EntraFlow = { verifier: oidc.randomPKCECodeVerifier(), state: oidc.randomState(), nonce: oidc.randomNonce(), next, link };
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: env.ENTRA_REDIRECT_URI, scope: 'openid profile email', response_mode: 'query', prompt: 'select_account',
    code_challenge: await oidc.calculatePKCECodeChallenge(flow.verifier), code_challenge_method: 'S256', state: flow.state, nonce: flow.nonce,
  });
  return { url: url.href, flow };
}

/** Troca o código pelo ID token (validado: assinatura, emissor, audiência, validade, nonce), aplica as regras e abre sessão. */
export async function finishEntraLogin(callbackUrl: URL, flow: EntraFlow) {
  const config = await configuration().catch(() => { throw new EntraError('indisponivel'); });
  let claims: oidc.IDToken;
  try {
    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, { pkceCodeVerifier: flow.verifier, expectedState: flow.state, expectedNonce: flow.nonce, idTokenExpected: true });
    claims = tokens.claims()!;
  } catch (e) {
    console.warn(`[entra] troca de código recusada: ${(e as { code?: string; name?: string }).code ?? (e as Error).name}`);
    throw new EntraError('falha');
  }
  if (claims.tid !== env.ENTRA_TENANT_ID) throw new EntraError('tenant');
  // Convidados (B2B) trazem `idp` do tenant de origem e UPN com #EXT#: o e-mail deles não é controlado pela Optsolv.
  if ((typeof claims.idp === 'string' && claims.idp !== claims.iss) || String(claims.preferred_username ?? '').includes('#EXT#')) throw new EntraError('convidado');
  const email = String(claims.email ?? claims.preferred_username ?? '').toLowerCase().trim();
  if (!email.includes('@') || !isEntraDomain(email)) throw new EntraError('dominio');
  const oid = typeof claims.oid === 'string' ? claims.oid : '';
  if (!oid) throw new EntraError('falha');
  const name = String(claims.name ?? email.split('@')[0]).trim().slice(0, 80);

  let [user] = await db.select().from(schema.users).where(eq(schema.users.entraOid, oid));
  if (!user) {
    const [byEmail] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    // E-mail já vinculado a outra pessoa do Entra (ex.: endereço reaproveitado): não assume a conta antiga.
    if (byEmail?.entraOid) throw new EntraError('conta');
    if (byEmail) {
      // Vínculo automático só para colaborador. Admin, cliente e admin de emergência só vinculam pelo fluxo explícito
      // (logado com senha → "Vincular conta Microsoft"), para que um e-mail alterado no diretório não tome a conta.
      const explicit = flow.link === byEmail.id;
      if (!explicit && (byEmail.role !== 'colaborador_optsolv' || env.EMERGENCY_ADMIN_EMAILS.includes(byEmail.email))) throw new EntraError('vincular');
      [user] = await db.update(schema.users).set({ entraOid: oid }).where(eq(schema.users.id, byEmail.id)).returning();
      await audit(await actorFromUser(user), 'user.link_entra', 'user', user.id, null);
    } else {
      // Senha aleatória descartada: a conta só entra pela Microsoft.
      [user] = await db.insert(schema.users).values({ email, name, role: 'colaborador_optsolv', entraOid: oid, passwordHash: await hashPassword(randomToken(32)) }).returning();
      await audit(await actorFromUser(user), 'user.create', 'user', user.id, null, { via: 'entra', role: user.role });
    }
  }
  if (flow.link && flow.link !== user.id) throw new EntraError('conta');
  if (!user.isActive) throw new EntraError('inativo');
  const session = await createSession(user);
  await audit(session.actor, 'auth.login', 'user', user.id, null, { via: 'entra' });
  return session;
}
