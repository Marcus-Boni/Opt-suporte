/**
 * Teste de ponta a ponta contra a API rodando (HTTP de verdade) e o MCP nos dois transportes:
 * STDIO (subprocesso, como no Claude Desktop) e HTTP remoto (como um agente na nuvem).
 * Simula o ciclo de um widget: credencial de cliente → solicitação → anexo → comentário → revogação.
 *
 * Grava dados: só roda com API e banco locais (mesma trava do seed; CONFIRM_DATABASE libera homologação).
 * Uso: API_URL=http://localhost:4000 pnpm --filter server e2e   (tokens: E2E_ADMIN_TOKEN, padrão o do seed)
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { env } from '../src/env.js';
import { assertDisposableDatabase, describeDatabase } from '../src/db/connection.js';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const ADMIN = process.env.E2E_ADMIN_TOKEN ?? 'osk_demo_admin_total_000000000000000000';
assertDisposableDatabase(env.DATABASE_URL, 'Teste de ponta a ponta');
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(API).hostname) && !process.env.CONFIRM_DATABASE) {
  throw new Error(`Teste de ponta a ponta recusado em ${API}: não é uma API local. Para homologação, rode com CONFIRM_DATABASE=<banco>.`);
}

const RUN = `e2e-${Date.now().toString(36)}`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let passed = 0;

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t = performance.now();
  try {
    const r = await fn();
    passed++;
    console.log(`  ✓ ${name} \x1b[2m${Math.round(performance.now() - t)} ms\x1b[0m`);
    return r;
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`);
    process.exitCode = 1;
    throw e;
  }
}
function check(cond: unknown, msg: string): asserts cond { if (!cond) throw new Error(msg); }

async function api(path: string, init: RequestInit & { token?: string; idem?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  if (init.idem) headers.set('idempotency-key', init.idem);
  if (typeof init.body === 'string') headers.set('content-type', 'application/json');
  const res = await fetch(`${API}/api/v1${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = text; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { body = JSON.parse(text); } catch { /* binário ou vazio */ }
  return { status: res.status, body, headers: res.headers };
}
const json = (v: unknown) => JSON.stringify(v);
const text = (r: { content?: unknown }) => ((r.content as { text?: string }[] | undefined)?.[0]?.text ?? '').split('\n')[0];

async function mcpHttp(token: string) {
  const client = new Client({ name: 'optsolv-e2e-http', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${API}/api/v1/mcp`), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  return client;
}

console.log(`\nOptsolv Suporte · ponta a ponta\n  API ${API} · MCP STDIO em ${describeDatabase(env.DATABASE_URL)}\n`);

console.log('API');
await step('saudável (/health)', async () => check((await fetch(`${API}/health`).then((r) => r.json())).ok, 'health não respondeu ok'));
await step('OpenAPI publica as rotas v1', async () => {
  const paths = Object.keys((await fetch(`${API}/openapi.json`).then((r) => r.json())).paths);
  check(paths.includes('/api/v1/requests') && paths.includes('/api/v1/requests/{id}/attachments'), `rotas ausentes: ${paths.length} publicadas`);
});
await step('sem credencial responde 401 no envelope padrão', async () => {
  const r = await api('/requests');
  check(r.status === 401 && r.body.error?.code === 'unauthorized', `${r.status} ${json(r.body)}`);
});

console.log('\nMCP STDIO');
const stdio = new Client({ name: 'optsolv-e2e-stdio', version: '1.0.0' });
await step('conecta como subprocesso e lista as 10 ferramentas', async () => {
  await stdio.connect(new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/mcp/index.ts'], cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), env: { ...process.env as Record<string, string>, OPTSOLV_API_TOKEN: ADMIN, DATABASE_URL: env.DATABASE_URL }, stderr: 'ignore' }));
  const tools = (await stdio.listTools()).tools;
  check(tools.length === 10, `ferramentas: ${tools.map((t) => t.name).join(', ')}`);
});
await step('API e MCP STDIO enxergam o mesmo banco', async () => {
  const viaApi = (await api('/clients', { token: ADMIN })).body.map((c: { id: string }) => c.id).sort();
  const viaMcp = ((await stdio.callTool({ name: 'list_clients', arguments: {} })).structuredContent as { clients: { id: string }[] }).clients.map((c) => c.id).sort();
  check(json(viaApi) === json(viaMcp), 'clientes diferentes: a API e o MCP STDIO estão em bancos distintos (confira DATABASE_URL)');
});

const projects: { id: string; clientId: string; name: string }[] = (await api('/projects', { token: ADMIN })).body;
const project = projects[0];
const otherProject = projects.find((p) => p.clientId !== project.clientId);
check(project, 'nenhum projeto no banco: rode pnpm db:seed');

console.log('\nWidget (credencial de cliente pela API)');
const cred = await step('admin cria credencial de menor privilégio (papel cliente, um cliente só)', async () => {
  const r = await api('/credentials', { method: 'POST', token: ADMIN, body: json({ name: `Widget ${RUN}`, role: 'cliente', clientId: project.clientId }) });
  check(r.status === 201 && r.body.token?.startsWith('osk_'), `${r.status} ${json(r.body)}`);
  return r.body as { id: string; token: string };
});
await step('identidade da credencial (/auth/me)', async () => {
  const r = await api('/auth/me', { token: cred.token });
  check(r.body.actor?.kind === 'credential' && r.body.actor.role === 'cliente', json(r.body.actor));
});
const payload = { projectId: project.id, category: 'problema', priority: 'alta', authorLabel: 'Carla Nunes', description: `Teste ${RUN}: ao salvar a visita sem internet a foto some.\n\n---\nContexto: tela /visitas/nova · versão 2.4.1 · Chrome 131` };
const created = await step('cria solicitação com quem reportou e Idempotency-Key (201)', async () => {
  const r = await api('/requests', { method: 'POST', token: cred.token, idem: RUN, body: json(payload) });
  check(r.status === 201, `${r.status} ${json(r.body)}`);
  check(r.body.source === 'api' && r.body.authorLabel === `Carla Nunes (via Agente: Widget ${RUN})`, `origem/autor: ${r.body.source} · ${r.body.authorLabel}`);
  return r.body as { id: string; clientCode: string; number: number };
});
await step('repetir o envio devolve a mesma solicitação (200)', async () => {
  const r = await api('/requests', { method: 'POST', token: cred.token, idem: RUN, body: json(payload) });
  check(r.status === 200 && r.body.id === created.id, `${r.status} ${r.body.id}`);
});
const attachment = await step('anexa captura de tela (multipart)', async () => {
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'captura.png');
  const r = await api(`/requests/${created.id}/attachments`, { method: 'POST', token: cred.token, body: form });
  check(r.status === 201, `${r.status} ${json(r.body)}`);
  return r.body as { id: string };
});
await step('baixa o anexo íntegro e revalida pelo ETag (304)', async () => {
  const res = await fetch(`${API}/api/v1/attachments/${attachment.id}`, { headers: { authorization: `Bearer ${cred.token}` } });
  const bytes = Buffer.from(await res.arrayBuffer());
  check(res.status === 200 && bytes.equals(PNG), `download ${res.status}, ${bytes.length} bytes`);
  const again = await fetch(`${API}/api/v1/attachments/${attachment.id}`, { headers: { authorization: `Bearer ${cred.token}`, 'if-none-match': res.headers.get('etag') ?? '' } });
  check(again.status === 304, `revalidação ${again.status}`);
});
await step('comenta e encontra pela busca', async () => {
  const c = await api(`/requests/${created.id}/comments`, { method: 'POST', token: cred.token, body: json({ body: 'Acontece também no tablet.' }) });
  check(c.status === 201, `comentário ${c.status} ${json(c.body)}`);
  const s = await api(`/requests?search=${encodeURIComponent(RUN)}`, { token: cred.token });
  check(s.body.total === 1 && s.body.items[0].id === created.id, `busca: ${json(s.body.total)}`);
});
if (otherProject) {
  await step('projeto de outro cliente responde 404 (sem revelar que existe)', async () => {
    const r = await api('/requests', { method: 'POST', token: cred.token, body: json({ ...payload, projectId: otherProject.id }) });
    check(r.status === 404, `${r.status} ${json(r.body)}`);
  });
}
await step('dados inválidos respondem 400 com detalhes', async () => {
  const r = await api('/requests', { method: 'POST', token: cred.token, body: json({ projectId: project.id, description: 'oi' }) });
  check(r.status === 400 && r.body.error?.code === 'validation' && r.body.error.details?.length, `${r.status} ${json(r.body)}`);
});

console.log('\nMCP HTTP (agente remoto)');
const http = await step('conecta em /api/v1/mcp com Bearer', () => mcpHttp(cred.token));
await step('cria solicitação pelo agente e ela aparece na API', async () => {
  const r = await http.callTool({ name: 'create_request', arguments: { projectId: project.id, description: `Teste ${RUN}: criada por agente via MCP remoto.`, category: 'melhoria', idempotencyKey: `${RUN}-mcp` } });
  check(!r.isError, text(r));
  const id = (r.structuredContent as { request: { id: string } }).request.id;
  const viaApi = await api(`/requests/${id}`, { token: ADMIN });
  check(viaApi.status === 200 && viaApi.body.source === 'mcp', `${viaApi.status} ${viaApi.body.source}`);
});
await step('ferramenta fora do escopo devolve erro, não dados', async () => {
  if (!otherProject) return;
  const r = await http.callTool({ name: 'list_projects', arguments: { clientId: otherProject.clientId } });
  check(r.isError, `esperava erro de escopo: ${text(r)}`);
});
await http.close();

console.log('\nMCP STDIO (agente local)');
await step('detalha e comenta (interno) a solicitação do widget pelo MCP STDIO', async () => {
  const r = await stdio.callTool({ name: 'get_request', arguments: { id: created.id } });
  check(!r.isError && text(r).startsWith(`${created.clientCode}-${created.number}`), text(r));
  const c = await stdio.callTool({ name: 'add_request_comment', arguments: { requestId: created.id, body: 'Triagem automática: reproduzido.', visibility: 'internal' } });
  check(!c.isError, text(c));
});
await stdio.close();

console.log('\nRevogação');
await step('credencial revogada perde acesso na API e no MCP na hora', async () => {
  const r = await api(`/credentials/${cred.id}`, { method: 'DELETE', token: ADMIN });
  check(r.status === 200, `revogar ${r.status}`);
  check((await api('/auth/me', { token: cred.token })).status === 401, 'API ainda aceita a credencial');
  const denied = await mcpHttp(cred.token).then(() => false, () => true);
  check(denied, 'MCP HTTP ainda aceita a credencial');
});

console.log(`\n${passed} verificações passaram · solicitação ${created.clientCode}-${created.number} (${RUN})\n`);
