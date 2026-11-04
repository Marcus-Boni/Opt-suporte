import { eq } from 'drizzle-orm';
import { buildApp } from '../src/app.js';
import { db, schema } from '../src/db/index.js';
import { actorFromToken } from '../src/auth/service.js';

export const PASSWORD = 'optsolv2026';
export const TOKEN_CIDADE = 'osk_demo_agente_cidade_0000000000000000';
export const TOKEN_ADMIN = 'osk_demo_admin_total_000000000000000000';

export async function app() {
  const a = await buildApp({ logger: false });
  await a.ready();
  return a;
}

export async function loginCookie(a: Awaited<ReturnType<typeof app>>, email: string) {
  const res = await a.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: PASSWORD } });
  if (res.statusCode !== 200) throw new Error(`login falhou para ${email}: ${res.body}`);
  const cookie = res.cookies.find((c) => c.name === 'osx_session')!;
  return { cookie: `${cookie.name}=${cookie.value}`, body: res.json() };
}

export async function clientBySlug(slug: string) {
  const [c] = await db.select().from(schema.clients).where(eq(schema.clients.slug, slug));
  if (!c) throw new Error(`Seed ausente: rode pnpm db:seed (cliente ${slug})`);
  return c;
}

export async function requestByNumber(clientId: string, number: number) {
  const rows = await db.select().from(schema.requests).where(eq(schema.requests.clientId, clientId));
  const r = rows.find((x) => x.number === number);
  if (!r) throw new Error(`Solicitação ${number} não encontrada no seed`);
  return r;
}

export async function projectByCode(clientId: string, code: string) {
  const rows = await db.select().from(schema.projects).where(eq(schema.projects.clientId, clientId));
  const p = rows.find((x) => x.code === code);
  if (!p) throw new Error(`Projeto ${code} não encontrado no seed`);
  return p;
}

export const actorFor = (token: string) => actorFromToken(token);
