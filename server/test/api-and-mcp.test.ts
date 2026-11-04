import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { app, clientBySlug, loginCookie, projectByCode, requestByNumber, TOKEN_CIDADE, actorFor } from './helpers.js';
import { createMcpServer } from '../src/mcp/server.js';
import { pool } from '../src/db/index.js';
import { parseWhatsApp, classify, similarity } from '../src/services/intake.js';

let api: Awaited<ReturnType<typeof app>>;
let admin: string, joao: string, otavio: string;
let cidadeId: string, marcaId: string;

beforeAll(async () => {
  api = await app();
  admin = (await loginCookie(api, 'admin@optsolv.demo')).cookie;
  joao = (await loginCookie(api, 'joao@cidadeengenharia.demo')).cookie;
  otavio = (await loginCookie(api, 'otavio@marcaambiental.demo')).cookie;
  cidadeId = (await clientBySlug('cidade-engenharia')).id;
  marcaId = (await clientBySlug('marca-ambiental')).id;
});
afterAll(async () => { await api.close(); await pool.end(); });

describe('API REST (D6)', () => {
  it('autor desfaz o próprio comentário; outro usuário não consegue', async () => {
    const req = await requestByNumber(cidadeId, 1);
    const created = await api.inject({ method: 'POST', url: `/api/v1/requests/${req.id}/comments`, headers: { cookie: admin }, payload: { body: 'Enviado por engano.', visibility: 'public' } });
    expect(created.statusCode).toBe(201);
    const cid = created.json().id;
    const byOther = await api.inject({ method: 'DELETE', url: `/api/v1/requests/${req.id}/comments/${cid}`, headers: { cookie: joao } });
    expect(byOther.statusCode).toBe(403);
    const byAuthor = await api.inject({ method: 'DELETE', url: `/api/v1/requests/${req.id}/comments/${cid}`, headers: { cookie: admin } });
    expect(byAuthor.statusCode).toBe(204);
    const after = await api.inject({ method: 'GET', url: `/api/v1/requests/${req.id}`, headers: { cookie: admin } });
    expect(after.json().comments.some((c: { id: string }) => c.id === cid)).toBe(false);
  });

  it('cria solicitação com credencial, idempotente, visível na listagem do cliente', async () => {
    const project = await projectByCode(cidadeId, 'GESTAO');
    const key = `vitest-${Date.now()}`;
    const payload = { projectId: project.id, description: 'Criada pelo teste automatizado via API com Idempotency-Key.', category: 'melhoria' };
    const first = await api.inject({ method: 'POST', url: '/api/v1/requests', headers: { authorization: `Bearer ${TOKEN_CIDADE}`, 'idempotency-key': key }, payload });
    expect(first.statusCode).toBe(201);
    expect(first.json().source).toBe('api');
    const replay = await api.inject({ method: 'POST', url: '/api/v1/requests', headers: { authorization: `Bearer ${TOKEN_CIDADE}`, 'idempotency-key': key }, payload });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().id).toBe(first.json().id);
    const seen = await api.inject({ method: 'GET', url: `/api/v1/requests/${first.json().id}`, headers: { cookie: joao } });
    expect(seen.statusCode).toBe(200);
    expect(seen.json().events[0].type).toBe('criada');
  });

  it('cliente cria solicitação pelo portal e reabre concluída com motivo (D4)', async () => {
    const project = await projectByCode(marcaId, 'PORTAL');
    const created = await api.inject({ method: 'POST', url: '/api/v1/requests', headers: { cookie: otavio }, payload: { projectId: project.id, description: 'Teste automatizado do portal: relatório de coletas por mês.' } });
    expect(created.statusCode).toBe(201);
    expect(created.json().source).toBe('portal');
    expect(created.json().title).toContain('Teste automatizado do portal');
    const forbidden = await api.inject({ method: 'PATCH', url: `/api/v1/requests/${created.json().id}`, headers: { cookie: otavio }, payload: { status: 'concluida' } });
    expect(forbidden.statusCode).toBe(400);
    const ma1 = await requestByNumber(marcaId, 1);
    const noReason = await api.inject({ method: 'PATCH', url: `/api/v1/requests/${ma1.id}`, headers: { cookie: otavio }, payload: { status: 'nova' } });
    expect(noReason.statusCode).toBe(400);
    const reopened = await api.inject({ method: 'PATCH', url: `/api/v1/requests/${ma1.id}`, headers: { cookie: otavio }, payload: { status: 'nova', reason: 'Voltou a acontecer no iPhone (teste automatizado).' } });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json().events.at(-1).type).toBe('reaberta');
    await api.inject({ method: 'PATCH', url: `/api/v1/requests/${ma1.id}`, headers: { cookie: admin }, payload: { status: 'concluida', note: 'Restaurado pelo teste.' } });
  });

  it('métricas vêm do banco e mudam após criar/concluir', async () => {
    const before = (await api.inject({ method: 'GET', url: `/api/v1/metrics?clientId=${cidadeId}`, headers: { cookie: admin } })).json();
    const project = await projectByCode(cidadeId, 'CAMPO');
    const created = await api.inject({ method: 'POST', url: '/api/v1/requests', headers: { cookie: admin }, payload: { projectId: project.id, description: 'Métrica: solicitação criada pelo teste automatizado.' } });
    await api.inject({ method: 'PATCH', url: `/api/v1/requests/${created.json().id}`, headers: { cookie: admin }, payload: { status: 'concluida' } });
    const after = (await api.inject({ method: 'GET', url: `/api/v1/metrics?clientId=${cidadeId}`, headers: { cookie: admin } })).json();
    expect(after.totals.requestsCreated).toBe(before.totals.requestsCreated + 1);
    expect(after.totals.requestsConcluded).toBe(before.totals.requestsConcluded + 1);
  });

  it('captura WhatsApp: preview não grava, commit grava com origem captura_whatsapp (D1)', async () => {
    const project = await projectByCode(cidadeId, 'GESTAO');
    const text = '[03/11/2026, 08:10:00] Carlos Mendes: Bom dia\n[03/11/2026, 08:11:00] Carlos Mendes: O relatório de visitas por engenheiro não abre quando filtro por obra, dá erro 500\n[03/11/2026, 08:30:00] Patrícia Nunes: Seria bom poder exportar o relatório em PDF para a diretoria';
    const preview = await api.inject({ method: 'POST', url: '/api/v1/intake/whatsapp-preview', headers: { cookie: admin }, payload: { clientId: cidadeId, projectId: project.id, text } });
    expect(preview.statusCode).toBe(200);
    const { mode, suggestions } = preview.json();
    expect(mode).toBe('demo-deterministico');
    expect(suggestions[0].ignored).toBeTruthy();
    expect(suggestions[1].category).toBe('problema');
    expect(suggestions[1].duplicateOf?.number).toBe(4);
    const items = suggestions.filter((s: { ignored?: string }) => !s.ignored).map((s: Record<string, unknown>) => ({ title: s.title, description: s.description, category: s.category, priority: s.priority, sender: s.sender, sentAt: s.sentAt, excerpt: s.excerpt }));
    const commit = await api.inject({ method: 'POST', url: '/api/v1/intake/whatsapp-commit', headers: { cookie: admin }, payload: { clientId: cidadeId, projectId: project.id, rawText: text, items } });
    expect(commit.statusCode).toBe(201);
    expect(commit.json().created).toHaveLength(2);
    expect(commit.json().created[0].source).toBe('captura_whatsapp');
    expect(commit.json().created[0].authorLabel).toContain('via WhatsApp');
  });

  it('entrega vinculada a duas solicitações só aparece ao cliente depois de publicada (D2/D3)', async () => {
    const project = await projectByCode(cidadeId, 'GESTAO');
    const ce8 = await requestByNumber(cidadeId, 8);
    const ce10 = await requestByNumber(cidadeId, 10);
    const created = await api.inject({ method: 'POST', url: '/api/v1/deliveries', headers: { cookie: admin }, payload: { projectId: project.id, title: 'Entrega do teste automatizado', summary: 'Resumo da entrega criada pelo teste.', requestIds: [ce8.id, ce10.id] } });
    expect(created.statusCode).toBe(201);
    expect(created.json().requests).toHaveLength(2);
    const hidden = await api.inject({ method: 'GET', url: `/api/v1/deliveries/${created.json().id}`, headers: { cookie: joao } });
    expect(hidden.statusCode).toBe(404);
    const evidence = await api.inject({ method: 'POST', url: `/api/v1/deliveries/${created.json().id}/evidences`, headers: { cookie: admin }, payload: { kind: 'observado', title: 'Validado no teste', sourceLabel: 'vitest' } });
    expect(evidence.statusCode).toBe(201);
    const measuredWithoutValue = await api.inject({ method: 'POST', url: `/api/v1/deliveries/${created.json().id}/evidences`, headers: { cookie: admin }, payload: { kind: 'medido', title: 'Sem número' } });
    expect(measuredWithoutValue.statusCode).toBe(400);
    const published = await api.inject({ method: 'PATCH', url: `/api/v1/deliveries/${created.json().id}`, headers: { cookie: admin }, payload: { status: 'publicada' } });
    expect(published.json().publishedAt).toBeTruthy();
    const visible = await api.inject({ method: 'GET', url: `/api/v1/deliveries/${created.json().id}`, headers: { cookie: joao } });
    expect(visible.statusCode).toBe(200);
    expect(visible.json().evidences).toHaveLength(1);
    const req = await api.inject({ method: 'GET', url: `/api/v1/requests/${ce8.id}`, headers: { cookie: joao } });
    expect(req.json().deliveries.some((d: { id: string }) => d.id === created.json().id)).toBe(true);
    expect(req.json().events.some((e: { type: string }) => e.type === 'entrega_publicada')).toBe(true);
  });

  it('apresentação gerada usa dados do período, é editável e só aparece ao cliente quando compartilhada (D5)', async () => {
    const res = await api.inject({ method: 'POST', url: '/api/v1/presentations', headers: { cookie: admin }, payload: { clientId: cidadeId, periodStart: '2026-05-01T00:00:00-03:00', periodEnd: '2026-10-31T23:59:59-03:00' } });
    expect(res.statusCode).toBe(201);
    const p = res.json();
    const kinds = p.slides.map((s: { kind: string }) => s.kind);
    expect(kinds[0]).toBe('capa');
    expect(kinds).toContain('entrega');
    expect(kinds).toContain('evolucao');
    const contexto = p.slides.find((s: { kind: string }) => s.kind === 'contexto');
    expect(contexto.data.deliveriesPublished).toBeGreaterThanOrEqual(4);
    const hidden = await api.inject({ method: 'GET', url: `/api/v1/presentations/${p.id}`, headers: { cookie: joao } });
    expect(hidden.statusCode).toBe(404);
    const edited = await api.inject({ method: 'PATCH', url: `/api/v1/presentations/${p.id}`, headers: { cookie: admin }, payload: { status: 'compartilhada', slides: [{ id: contexto.id, title: 'Título editado pelo teste', body: 'Narrativa editada.' }] } });
    expect(edited.statusCode).toBe(200);
    const ctx = edited.json().slides.find((s: { id: string }) => s.id === contexto.id);
    expect(ctx.title).toBe('Título editado pelo teste');
    expect(ctx.data.deliveriesPublished).toBe(contexto.data.deliveriesPublished);
    const shared = await api.inject({ method: 'GET', url: `/api/v1/presentations/${p.id}`, headers: { cookie: joao } });
    expect(shared.statusCode).toBe(200);
    await api.inject({ method: 'DELETE', url: `/api/v1/presentations/${p.id}`, headers: { cookie: admin } });
  });

  it('OpenAPI documenta as rotas v1', async () => {
    const res = await api.inject({ method: 'GET', url: '/openapi.json' });
    const paths = Object.keys(res.json().paths);
    expect(paths).toEqual(expect.arrayContaining(['/api/v1/requests', '/api/v1/requests/{id}', '/api/v1/intake/whatsapp-preview', '/api/v1/deliveries', '/api/v1/metrics', '/api/v1/presentations']));
  });
});

describe('MCP (D6) — mesmas regras, mesmo banco', () => {
  async function connect(token: string) {
    const actor = await actorFor(token);
    if (!actor) throw new Error('credencial inválida');
    const server = createMcpServer(actor);
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await server.connect(serverT);
    const client = new Client({ name: 'vitest', version: '1.0.0' });
    await client.connect(clientT);
    return { client, close: async () => { await client.close(); await server.close(); } };
  }

  it('expõe as ferramentas com schema e cria solicitação visível na UI/API', async () => {
    const { client, close } = await connect(TOKEN_CIDADE);
    try {
      const tools = (await client.listTools()).tools.map((t) => t.name);
      expect(tools).toEqual(expect.arrayContaining(['list_clients', 'list_projects', 'search_requests', 'get_request', 'create_request', 'add_request_comment', 'create_delivery', 'link_delivery_requests', 'get_value_summary', 'create_presentation']));
      const clients = await client.callTool({ name: 'list_clients', arguments: {} });
      const list = (clients.structuredContent as { clients: { id: string }[] }).clients;
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(cidadeId);
      const project = await projectByCode(cidadeId, 'CAMPO');
      const created = await client.callTool({ name: 'create_request', arguments: { projectId: project.id, description: 'Criada pelo MCP no teste automatizado: alerta de bateria baixa no app de campo.', category: 'melhoria', idempotencyKey: `mcp-${Date.now()}` } });
      expect(created.isError).toBeFalsy();
      const req = (created.structuredContent as { request: { id: string; source: string } }).request;
      expect(req.source).toBe('mcp');
      const viaApi = await api.inject({ method: 'GET', url: `/api/v1/requests/${req.id}`, headers: { cookie: joao } });
      expect(viaApi.statusCode).toBe(200);
      expect(viaApi.json().source).toBe('mcp');
    } finally { await close(); }
  });

  it('ferramentas respeitam o escopo do tenant', async () => {
    const { client, close } = await connect(TOKEN_CIDADE);
    try {
      const ma1 = await requestByNumber(marcaId, 1);
      const res = await client.callTool({ name: 'get_request', arguments: { id: ma1.id } });
      expect(res.isError).toBe(true);
      const maProject = await projectByCode(marcaId, 'PORTAL');
      const create = await client.callTool({ name: 'create_delivery', arguments: { projectId: maProject.id, title: 'Cross tenant', summary: 'Não deve ser criada.' } });
      expect(create.isError).toBe(true);
      const summary = await client.callTool({ name: 'get_value_summary', arguments: {} });
      expect((summary.structuredContent as { clients: unknown[] }).clients).toHaveLength(1);
    } finally { await close(); }
  });
});

describe('heurísticas de captura (unidade)', () => {
  it('reconhece os dois formatos de exportação do WhatsApp', () => {
    const msgs = parseWhatsApp('[03/11/2026, 08:10:00] Ana: primeira\n03/11/2026 08:11 - Bia: segunda\ncontinuação');
    expect(msgs).toHaveLength(2);
    expect(msgs[1].text).toBe('segunda\ncontinuação');
  });
  it('saudação com complemento não vira título nem se funde ao pedido', async () => {
    const project = await projectByCode(cidadeId, 'GESTAO');
    const text = '[03/11/2026, 08:10:00] Carlos Mendes: Bom dia pessoal\n[03/11/2026, 08:11:00] Carlos Mendes: A tela de orçamentos trava ao salvar';
    const res = await api.inject({ method: 'POST', url: '/api/v1/intake/whatsapp-preview', headers: { cookie: admin }, payload: { clientId: cidadeId, projectId: project.id, text } });
    const s = res.json().suggestions;
    expect(s[0].ignored).toBeTruthy();
    expect(s[1].title).toBe('A tela de orçamentos trava ao salvar');
    expect(s[1].category).toBe('problema');
  });
  it('classifica categoria e prioridade', () => {
    expect(classify('A tela não abre, dá erro 500').category).toBe('problema');
    expect(classify('Como faço para exportar?').category).toBe('duvida');
    expect(classify('Urgente: ninguém consegue aprovar hoje').priority).toBe('alta');
  });
  it('mede similaridade por tokens', () => {
    expect(similarity('relatório de visitas por engenheiro', 'relatório de visitas por engenheiro com filtro')).toBeGreaterThan(0.5);
    expect(similarity('upload de documentos', 'menu não abre no celular')).toBe(0);
  });
});

describe('anexos (upload multipart)', () => {
  const multipart = (fileName: string, mime: string, content: Buffer) => {
    const boundary = '----vitest' + Date.now();
    const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mime}\r\n\r\n`);
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    return { body: Buffer.concat([head, content, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
  };
  it('cliente anexa imagem à própria solicitação; tipo proibido e tamanho acima do limite são recusados', async () => {
    const ma8 = await requestByNumber(marcaId, 8);
    const png = multipart('print.png', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
    const ok = await api.inject({ method: 'POST', url: `/api/v1/requests/${ma8.id}/attachments`, headers: { cookie: otavio, ...png.headers }, payload: png.body });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().fileName).toBe('print.png');
    const download = await api.inject({ method: 'GET', url: `/api/v1/attachments/${ok.json().id}`, headers: { cookie: otavio } });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('image/png');
    const crossTenant = await api.inject({ method: 'GET', url: `/api/v1/attachments/${ok.json().id}`, headers: { cookie: joao } });
    expect(crossTenant.statusCode).toBe(404);
    const exe = multipart('virus.exe', 'application/x-msdownload', Buffer.from('MZ'));
    const refused = await api.inject({ method: 'POST', url: `/api/v1/requests/${ma8.id}/attachments`, headers: { cookie: otavio, ...exe.headers }, payload: exe.body });
    expect(refused.statusCode).toBe(400);
    const big = multipart('grande.txt', 'text/plain', Buffer.alloc(5 * 1024 * 1024 + 1, 97));
    const tooBig = await api.inject({ method: 'POST', url: `/api/v1/requests/${ma8.id}/attachments`, headers: { cookie: otavio, ...big.headers }, payload: big.body });
    expect([400, 413]).toContain(tooBig.statusCode);
    const foreign = await api.inject({ method: 'POST', url: `/api/v1/requests/${ma8.id}/attachments`, headers: { cookie: joao, ...png.headers }, payload: png.body });
    expect(foreign.statusCode).toBe(404);
  });
});

describe('concorrência', () => {
  it('criações simultâneas no mesmo cliente recebem números distintos', async () => {
    const project = await projectByCode(cidadeId, 'GESTAO');
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => api.inject({ method: 'POST', url: '/api/v1/requests', headers: { cookie: admin }, payload: { projectId: project.id, description: `Concorrência ${i}: criada em paralelo pelo teste.` } })));
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    const numbers = results.map((r) => r.json().number);
    expect(new Set(numbers).size).toBe(6);
  });
});
