import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actorFor, app, clientBySlug, loginCookie, projectByCode, requestByNumber, TOKEN_CIDADE } from './helpers.js';
import { pool } from '../src/db/index.js';

let api: Awaited<ReturnType<typeof app>>;
let joao: string, otavio: string, admin: string;
let cidadeId: string, marcaId: string;

beforeAll(async () => {
  api = await app();
  joao = (await loginCookie(api, 'joao@cidadeengenharia.demo')).cookie;
  otavio = (await loginCookie(api, 'otavio@marcaambiental.demo')).cookie;
  admin = (await loginCookie(api, 'admin@optsolv.demo')).cookie;
  cidadeId = (await clientBySlug('cidade-engenharia')).id;
  marcaId = (await clientBySlug('marca-ambiental')).id;
});
afterAll(async () => { await api.close(); await pool.end(); });

describe('isolamento multi-tenant (D3, D7)', () => {
  it('cliente só lista solicitações do próprio tenant', async () => {
    const res = await api.inject({ method: 'GET', url: '/api/v1/requests?pageSize=100', headers: { cookie: joao } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((i: { clientId: string }) => i.clientId === cidadeId)).toBe(true);
  });

  it('cliente da Cidade não acessa solicitação da Marca por ID (404)', async () => {
    const ma7 = await requestByNumber(marcaId, 7);
    const res = await api.inject({ method: 'GET', url: `/api/v1/requests/${ma7.id}`, headers: { cookie: joao } });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });

  it('cliente não consegue filtrar por clientId alheio nem ver entregas/apresentações/anexos de outro tenant', async () => {
    const byClient = await api.inject({ method: 'GET', url: `/api/v1/requests?clientId=${marcaId}`, headers: { cookie: joao } });
    expect(byClient.statusCode).toBe(404);
    const dels = await api.inject({ method: 'GET', url: '/api/v1/deliveries?pageSize=100', headers: { cookie: otavio } });
    expect(dels.json().items.every((d: { clientId: string; status: string }) => d.clientId === marcaId && d.status === 'publicada')).toBe(true);
    const pres = await api.inject({ method: 'GET', url: '/api/v1/presentations', headers: { cookie: joao } });
    expect(pres.json().every((p: { clientId: string; status: string }) => p.clientId === cidadeId && p.status === 'compartilhada')).toBe(true);
    const ma7 = await api.inject({ method: 'GET', url: `/api/v1/requests/${(await requestByNumber(marcaId, 7)).id}`, headers: { cookie: otavio } });
    const attachmentId = ma7.json().attachments[0].id;
    const cross = await api.inject({ method: 'GET', url: `/api/v1/attachments/${attachmentId}`, headers: { cookie: joao } });
    expect(cross.statusCode).toBe(404);
    const own = await api.inject({ method: 'GET', url: `/api/v1/attachments/${attachmentId}`, headers: { cookie: otavio } });
    expect(own.statusCode).toBe(200);
  });

  it('comentários internos nunca chegam ao cliente, mas a equipe os vê', async () => {
    const ce9 = await requestByNumber(cidadeId, 9);
    const asClient = await api.inject({ method: 'GET', url: `/api/v1/requests/${ce9.id}`, headers: { cookie: joao } });
    expect(asClient.statusCode).toBe(200);
    expect(asClient.json().comments.some((c: { visibility: string }) => c.visibility === 'internal')).toBe(false);
    expect(JSON.stringify(asClient.json())).not.toContain('Nota interna');
    const asAdmin = await api.inject({ method: 'GET', url: `/api/v1/requests/${ce9.id}`, headers: { cookie: admin } });
    expect(asAdmin.json().comments.some((c: { visibility: string }) => c.visibility === 'internal')).toBe(true);
  });

  it('cliente que pede comentário interno recebe comentário público', async () => {
    const ce12 = await requestByNumber(cidadeId, 12);
    const res = await api.inject({ method: 'POST', url: `/api/v1/requests/${ce12.id}/comments`, headers: { cookie: joao }, payload: { body: 'Teste automatizado: tentativa de nota interna pelo portal', visibility: 'internal' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().visibility).toBe('public');
  });

  it('credencial de API com escopo Cidade não cria solicitação em projeto da Marca', async () => {
    const maProject = await projectByCode(marcaId, 'PORTAL');
    const res = await api.inject({ method: 'POST', url: '/api/v1/requests', headers: { authorization: `Bearer ${TOKEN_CIDADE}` }, payload: { projectId: maProject.id, description: 'tentativa cross-tenant via credencial' } });
    expect(res.statusCode).toBe(404);
  });

  it('entrega não pode ser vinculada a solicitação de outro cliente', async () => {
    const ceProject = await projectByCode(cidadeId, 'GESTAO');
    const created = await api.inject({ method: 'POST', url: '/api/v1/deliveries', headers: { cookie: admin }, payload: { projectId: ceProject.id, title: 'Teste automatizado de vínculo', summary: 'Entrega criada pelo teste de isolamento.' } });
    expect(created.statusCode).toBe(201);
    const ma1 = await requestByNumber(marcaId, 1);
    const link = await api.inject({ method: 'POST', url: `/api/v1/deliveries/${created.json().id}/requests`, headers: { cookie: admin }, payload: { requestIds: [ma1.id] } });
    expect(link.statusCode).toBe(404);
  });

  it('contadores por cliente são calculados no banco (regressão de subquery)', async () => {
    const res = await api.inject({ method: 'GET', url: '/api/v1/clients', headers: { cookie: admin } });
    const cidade = res.json().find((c: { id: string }) => c.id === cidadeId);
    expect(cidade.projectCount).toBeGreaterThan(0);
    expect(cidade.openRequests).toBeGreaterThan(0);
    expect(cidade.publishedDeliveries).toBeGreaterThan(0);
    const metrics = await api.inject({ method: 'GET', url: '/api/v1/metrics', headers: { cookie: admin } });
    expect(metrics.json().clients.find((c: { clientId: string }) => c.clientId === cidadeId).open).toBeGreaterThan(0);
  });

  it('sem autenticação: 401', async () => {
    const res = await api.inject({ method: 'GET', url: '/api/v1/requests' });
    expect(res.statusCode).toBe(401);
  });
});

describe('apresentações e login (auditoria)', () => {
  it('apresentação de um cliente nunca referencia solicitações de outro', async () => {
    const res = await api.inject({ method: 'POST', url: '/api/v1/presentations', headers: { cookie: admin }, payload: { clientId: marcaId, periodStart: '2026-06-01T00:00:00Z', periodEnd: '2026-11-03T23:59:59Z' } });
    expect(res.statusCode).toBe(201);
    const ids = res.json().slides.flatMap((s: { refs?: { type: string; id: string }[] }) => (s.refs ?? []).filter((r) => r.type === 'request').map((r) => r.id));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const r = await api.inject({ method: 'GET', url: `/api/v1/requests/${id}`, headers: { cookie: admin } });
      expect(r.json().clientId).toBe(marcaId);
    }
    await api.inject({ method: 'DELETE', url: `/api/v1/presentations/${res.json().id}`, headers: { cookie: admin } });
  });

  it('bloqueia o login após 10 senhas erradas (429)', async () => {
    const payload = { email: 'ninguem@optsolv.demo', password: 'errada' };
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await api.inject({ method: 'POST', url: '/api/v1/auth/login', payload })).statusCode;
    expect(last).toBe(429);
  });

  it('bloqueia o IP que erra senhas de várias contas (varredura), com Retry-After', async () => {
    const remoteAddress = '203.0.113.7';
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await api.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress, payload: { email: `conta${i}@exemplo.com`, password: 'errada' } })).statusCode);
    expect(statuses.slice(0, 30).every((s) => s === 401)).toBe(true);
    const blocked = await api.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress, payload: { email: 'admin@optsolv.demo', password: 'optsolv2026' } });
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    // Outro IP continua entrando normalmente.
    expect((await api.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: '203.0.113.8', payload: { email: 'admin@optsolv.demo', password: 'optsolv2026' } })).statusCode).toBe(200);
  });

  it('limita as análises da captura por pessoa (custo da IA)', async () => {
    const ana = (await loginCookie(api, 'ana@optsolv.demo')).cookie;
    const send = () => api.inject({ method: 'POST', url: '/api/v1/intake/whatsapp-preview', headers: { cookie: ana }, payload: { clientId: cidadeId, text: '[03/11/2026, 08:11:00] Carlos: deu erro ao salvar' } });
    for (let i = 0; i < 20; i++) expect((await send()).statusCode).toBe(200);
    const res = await send();
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('too_many_requests');
    // O limite é por identidade: outra pessoa não é afetada.
    expect((await api.inject({ method: 'POST', url: '/api/v1/intake/whatsapp-preview', headers: { cookie: admin }, payload: { clientId: cidadeId, text: 'erro' } })).statusCode).toBe(200);
  });

  it('cliente não escolhe o nome do autor da solicitação', async () => {
    const project = await projectByCode(cidadeId, 'GESTAO');
    const res = await api.inject({ method: 'POST', url: '/api/v1/requests', headers: { cookie: joao }, payload: { projectId: project.id, description: 'Teste de autoria forjada no pedido.', source: 'portal', authorLabel: 'Helena Prado (Optsolv)' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().authorLabel).toBe('João Pereira');
  });

  it('credencial de API não herda a identidade de quem a criou', async () => {
    const actor = await actorFor(TOKEN_CIDADE);
    expect(actor?.kind).toBe('credential');
    expect(actor?.userId).toBeNull();
  });

  it('respostas trazem X-Content-Type-Options: nosniff', async () => {
    const res = await api.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
