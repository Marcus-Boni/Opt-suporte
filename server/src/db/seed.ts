/**
 * Seed de demonstração — TODOS os dados são fictícios.
 * "Cidade Engenharia" e "Marca Ambiental" são apenas nomes de cenário; pessoas, pedidos, datas e números não descrevem fatos reais.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from './index.js';
import { env } from '../env.js';
import { hashPassword, sha256 } from '../auth/password.js';
import { generatePresentation, updatePresentation } from '../services/presentations.js';
import type { Actor } from '../auth/actor.js';
import { pathToFileURL } from 'node:url';

const PASSWORD = 'optsolv2026';
export const DEMO_TOKENS = {
  agenteCidade: 'osk_demo_agente_cidade_0000000000000000',
  adminTotal: 'osk_demo_admin_total_000000000000000000',
};
const d = (s: string) => new Date(`${s}:00-03:00`);

/** Aplica o seed uma única vez; devolve false se o banco já tinha dados. */
export async function runSeed(log: (msg: string) => void = console.log) {
if (process.env.NODE_ENV === 'production') throw new Error('O seed de demonstração grava tokens públicos: não rode em produção.');
const [existing] = await db.select({ id: schema.clients.id }).from(schema.clients).limit(1);
if (existing) {
  log('Seed já aplicado. Para recomeçar: pnpm db:reset');
  return false;
}

// ---------- clientes e projetos ----------
const [cidade, marca] = await db.insert(schema.clients).values([
  { slug: 'cidade-engenharia', shortCode: 'CE', name: 'Cidade Engenharia', segment: 'Pré-moldados de concreto e obras', description: 'Cenário fictício: plataforma de gestão de obras, visitas técnicas e orçamentos.' },
  { slug: 'marca-ambiental', shortCode: 'MA', name: 'Marca Ambiental', segment: 'Gestão ambiental e resíduos', description: 'Cenário fictício: portal do cliente e operações de coleta com laudos.' },
]).returning();
const [ceGestao, ceCampo, maPortal, maMobile] = await db.insert(schema.projects).values([
  { clientId: cidade.id, code: 'GESTAO', name: 'Plataforma de Gestão', description: 'Cadastro de visitas, orçamentos e aprovações.' },
  { clientId: cidade.id, code: 'CAMPO', name: 'App de Campo', description: 'Aplicativo usado pelos engenheiros nas obras.' },
  { clientId: marca.id, code: 'PORTAL', name: 'Portal do Cliente', description: 'Documentos, laudos e acompanhamento de coletas.' },
  { clientId: marca.id, code: 'MOBILE', name: 'Operações Mobile', description: 'Uso em tablets pelas equipes de coleta.' },
]).returning();

// ---------- usuários ----------
const pw = await hashPassword(PASSWORD);
const [helena, ana, bruno, joao, marina, otavio] = await db.insert(schema.users).values([
  { name: 'Helena Prado', email: 'admin@optsolv.demo', passwordHash: pw, role: 'admin_optsolv' },
  { name: 'Ana Ribeiro', email: 'ana@optsolv.demo', passwordHash: pw, role: 'colaborador_optsolv' },
  { name: 'Bruno Saraiva', email: 'bruno@optsolv.demo', passwordHash: pw, role: 'colaborador_optsolv' },
  { name: 'João Pereira', email: 'joao@cidadeengenharia.demo', passwordHash: pw, role: 'cliente', clientId: cidade.id },
  { name: 'Marina Lobo', email: 'marina@cidadeengenharia.demo', passwordHash: pw, role: 'cliente', clientId: cidade.id },
  { name: 'Otávio Reis', email: 'otavio@marcaambiental.demo', passwordHash: pw, role: 'cliente', clientId: marca.id },
]).returning();
await db.insert(schema.memberships).values([
  { userId: ana.id, clientId: cidade.id }, { userId: ana.id, clientId: marca.id }, { userId: bruno.id, clientId: marca.id },
]);
await db.insert(schema.apiCredentials).values([
  { name: 'Agente demo · Cidade Engenharia', prefix: DEMO_TOKENS.agenteCidade.slice(0, 12), tokenHash: sha256(DEMO_TOKENS.agenteCidade), role: 'colaborador_optsolv', clientId: cidade.id, createdBy: helena.id },
  { name: 'Integração admin (demo)', prefix: DEMO_TOKENS.adminTotal.slice(0, 12), tokenHash: sha256(DEMO_TOKENS.adminTotal), role: 'admin_optsolv', clientId: null, createdBy: helena.id },
]);

// ---------- mensagens de origem (captura WhatsApp fictícia) ----------
const [ceSource] = await db.insert(schema.sourceMessages).values({
  clientId: cidade.id, projectId: ceGestao.id, createdByLabel: 'Ana Ribeiro', createdAt: d('2026-06-02T09:40'),
  rawText: `[02/06/2026, 09:12:10] Carlos Mendes: Bom dia pessoal, o cadastro de visitas não salva quando o endereço tem complemento. Dá erro e perde tudo.
[02/06/2026, 09:14:02] Carlos Mendes: Já aconteceu 3 vezes hoje com a equipe da obra do Jardim Camburi
[02/06/2026, 09:20:45] Patrícia Nunes: Seria bom ter um filtro por obra na listagem de visitas, hoje a gente rola a lista inteira
[02/06/2026, 09:21:30] Patrícia Nunes: 👍`,
}).returning();

// ---------- solicitações ----------
type Req = typeof schema.requests.$inferInsert;
const r = (over: Partial<Req> & Pick<Req, 'number' | 'title' | 'description' | 'createdAt'>): Req => ({
  clientId: cidade.id, projectId: ceGestao.id, category: 'melhoria', priority: 'media', status: 'nova', source: 'admin', authorLabel: 'Ana Ribeiro', authorUserId: ana.id,
  updatedAt: over.createdAt, ...over,
});
const ceReqs = await db.insert(schema.requests).values([
  r({ number: 1, title: 'Cadastro de visitas não salva quando o endereço tem complemento', description: 'O cadastro de visitas não salva quando o endereço tem complemento. Dá erro e perde tudo. Já aconteceu 3 vezes hoje com a equipe da obra do Jardim Camburi.', category: 'problema', priority: 'alta', status: 'concluida', source: 'captura_whatsapp', authorLabel: 'Carlos Mendes (via WhatsApp)', authorUserId: null, assigneeUserId: ana.id, sourceMessageId: ceSource.id, sourceExcerpt: 'Carlos Mendes: o cadastro de visitas não salva quando o endereço tem complemento. Dá erro e perde tudo.', createdAt: d('2026-06-02T09:40'), closedAt: d('2026-06-19T16:10'), updatedAt: d('2026-06-19T16:10') }),
  r({ number: 2, title: 'Filtro de busca por obra na listagem de visitas', description: 'Seria bom ter um filtro por obra na listagem de visitas; hoje a equipe rola a lista inteira para encontrar o registro.', category: 'melhoria', status: 'concluida', source: 'captura_whatsapp', authorLabel: 'Patrícia Nunes (via WhatsApp)', authorUserId: null, assigneeUserId: ana.id, sourceMessageId: ceSource.id, sourceExcerpt: 'Patrícia Nunes: Seria bom ter um filtro por obra na listagem de visitas', createdAt: d('2026-06-02T09:41'), closedAt: d('2026-09-09T11:00'), updatedAt: d('2026-09-09T11:00') }),
  r({ number: 3, title: 'Etapa de aprovação do orçamento pelo gestor', description: 'Hoje o orçamento é aprovado por e-mail fora da plataforma. Precisamos de uma etapa de aprovação dentro do fluxo, com registro de quem aprovou e quando.', category: 'nova_funcionalidade', priority: 'alta', status: 'concluida', source: 'portal', authorLabel: 'João Pereira', authorUserId: joao.id, assigneeUserId: ana.id, createdAt: d('2026-07-08T10:15'), closedAt: d('2026-08-27T18:00'), updatedAt: d('2026-08-27T18:00') }),
  r({ number: 4, title: 'Relatório de visitas por engenheiro', description: 'Queremos um relatório mensal de visitas realizadas por engenheiro, com filtro por obra e período, para a reunião de diretoria.', category: 'nova_funcionalidade', status: 'em_andamento', source: 'portal', authorLabel: 'Marina Lobo', authorUserId: marina.id, assigneeUserId: ana.id, createdAt: d('2026-09-15T14:05'), updatedAt: d('2026-10-28T09:30') }),
  r({ number: 5, title: 'Ordenar visitas pelas mais recentes', description: 'A listagem de visitas aparece em ordem aleatória. Poderia vir das mais recentes para as mais antigas por padrão.', category: 'melhoria', priority: 'baixa', status: 'concluida', source: 'admin', assigneeUserId: ana.id, createdAt: d('2026-08-20T08:50'), closedAt: d('2026-09-09T11:05'), updatedAt: d('2026-09-09T11:05') }),
  r({ number: 6, title: 'Como exportar a agenda de visitas para Excel?', description: 'Como faço para exportar a agenda de visitas da semana para Excel? Não encontrei o botão.', category: 'duvida', priority: 'baixa', status: 'concluida', source: 'portal', authorLabel: 'João Pereira', authorUserId: joao.id, assigneeUserId: ana.id, createdAt: d('2026-09-22T16:40'), closedAt: d('2026-09-23T09:10'), updatedAt: d('2026-09-23T09:10') }),
  r({ number: 7, title: 'Erro ao anexar foto no app de campo', description: 'No app de campo, ao anexar foto da visita, aparece "falha ao enviar" e a foto some. Acontece em celulares com pouca memória.', category: 'problema', priority: 'alta', status: 'concluida', source: 'portal', projectId: ceCampo.id, authorLabel: 'João Pereira', authorUserId: joao.id, assigneeUserId: ana.id, createdAt: d('2026-10-01T07:55'), closedAt: d('2026-10-14T17:20'), updatedAt: d('2026-10-14T17:20') }),
  r({ number: 8, title: 'Notificar engenheiro quando visita é reagendada', description: 'Quando a visita é reagendada pelo escritório, o engenheiro não fica sabendo. Poderia enviar uma notificação no app.', category: 'melhoria', status: 'planejada', source: 'admin', projectId: ceCampo.id, assigneeUserId: ana.id, createdAt: d('2026-10-06T11:20'), updatedAt: d('2026-10-20T10:00') }),
  r({ number: 9, title: 'Tela de aprovação lenta com muitos itens', description: 'A tela de aprovação de orçamentos demora mais de 20 segundos para abrir quando há muitos itens. Fica difícil usar na reunião.', category: 'problema', priority: 'alta', status: 'em_andamento', source: 'portal', authorLabel: 'Marina Lobo', authorUserId: marina.id, assigneeUserId: ana.id, createdAt: d('2026-10-13T09:00'), updatedAt: d('2026-10-30T15:45') }),
  r({ number: 10, title: 'Campo de observações na visita', description: 'Faltou um campo livre de observações na visita para registrar pendências encontradas na obra.', category: 'melhoria', status: 'aguardando_cliente', source: 'admin', assigneeUserId: ana.id, createdAt: d('2026-10-16T13:30'), updatedAt: d('2026-10-27T16:00') }),
  r({ number: 11, title: 'Dashboard de visitas realizadas vs planejadas', description: 'A diretoria quer ver, por mês, quantas visitas foram planejadas e quantas aconteceram de fato, por obra.', category: 'nova_funcionalidade', status: 'em_triagem', source: 'portal', authorLabel: 'Marina Lobo', authorUserId: marina.id, createdAt: d('2026-10-22T10:10'), updatedAt: d('2026-10-22T10:10') }),
  r({ number: 12, title: 'Login expira muito rápido no app de campo', description: 'O app de campo pede login de novo a cada poucas horas. Em obra sem sinal isso trava o trabalho.', category: 'problema', status: 'nova', source: 'portal', projectId: ceCampo.id, authorLabel: 'João Pereira', authorUserId: joao.id, createdAt: d('2026-10-30T08:20'), updatedAt: d('2026-10-30T08:20') }),
  r({ number: 13, title: 'Duplicidade de cadastro de cliente', description: 'Aparecem dois cadastros para a mesma construtora na tela de orçamentos.', category: 'problema', status: 'cancelada', source: 'admin', createdAt: d('2026-07-30T15:00'), closedAt: d('2026-08-02T10:00'), updatedAt: d('2026-08-02T10:00') }),
  r({ number: 14, title: 'Checklist de segurança na visita', description: 'Incluir um checklist de segurança obrigatório antes de concluir a visita técnica (EPI, sinalização, acesso).', category: 'nova_funcionalidade', status: 'nova', source: 'api', authorLabel: 'Agente: Agente demo · Cidade Engenharia', authorUserId: null, createdAt: d('2026-11-01T09:00'), updatedAt: d('2026-11-01T09:00') }),
]).returning();
const CE = Object.fromEntries(ceReqs.map((x) => [x.number, x]));

const m = (over: Partial<Req> & Pick<Req, 'number' | 'title' | 'description' | 'createdAt'>): Req => ({
  clientId: marca.id, projectId: maPortal.id, category: 'melhoria', priority: 'media', status: 'nova', source: 'portal', authorLabel: 'Otávio Reis', authorUserId: otavio.id,
  updatedAt: over.createdAt, ...over,
});
const maReqs = await db.insert(schema.requests).values([
  m({ number: 1, title: 'Menu não abre no celular', description: 'No celular, o menu do portal não abre ao tocar no ícone. Só funciona no computador.', category: 'problema', priority: 'alta', status: 'concluida', assigneeUserId: bruno.id, createdAt: d('2026-06-25T09:30'), closedAt: d('2026-07-24T17:30'), updatedAt: d('2026-07-24T17:30') }),
  m({ number: 2, title: 'Upload de documentos aceita só PDF', description: 'Precisamos enviar fotos e planilhas junto com os documentos da coleta, mas o upload só aceita PDF.', category: 'melhoria', status: 'concluida', assigneeUserId: bruno.id, createdAt: d('2026-07-14T11:00'), closedAt: d('2026-08-29T16:00'), updatedAt: d('2026-08-29T16:00') }),
  m({ number: 3, title: 'Mensagem de erro genérica ao enviar laudo', description: 'Ao enviar um laudo aparece apenas "ocorreu um erro". Não sabemos se foi o tamanho do arquivo ou outra coisa.', category: 'problema', status: 'concluida', assigneeUserId: bruno.id, createdAt: d('2026-08-05T15:20'), closedAt: d('2026-08-29T16:05'), updatedAt: d('2026-08-29T16:05') }),
  m({ number: 4, title: 'Assinatura digital do laudo pelo cliente', description: 'Queremos que o cliente final possa assinar o laudo digitalmente dentro do portal, sem imprimir.', category: 'nova_funcionalidade', status: 'planejada', assigneeUserId: bruno.id, createdAt: d('2026-09-03T10:00'), updatedAt: d('2026-10-10T09:00') }),
  m({ number: 5, title: 'Histórico de coletas por unidade', description: 'Ver o histórico de coletas de cada unidade geradora, com datas, volumes e laudos vinculados.', category: 'nova_funcionalidade', status: 'em_andamento', assigneeUserId: bruno.id, createdAt: d('2026-09-18T14:40'), updatedAt: d('2026-10-29T11:15') }),
  m({ number: 6, title: 'Como alterar a senha de acesso?', description: 'Como altero a senha de acesso do portal? Não achei a opção.', category: 'duvida', priority: 'baixa', status: 'concluida', assigneeUserId: ana.id, createdAt: d('2026-10-02T08:10'), closedAt: d('2026-10-02T10:30'), updatedAt: d('2026-10-02T10:30') }),
  m({ number: 7, title: 'Tabela de resíduos não rola no tablet', description: 'No tablet das equipes, a tabela de resíduos não rola para o lado e as últimas colunas ficam escondidas.', category: 'problema', priority: 'alta', status: 'aguardando_cliente', projectId: maMobile.id, assigneeUserId: bruno.id, createdAt: d('2026-10-09T13:00'), updatedAt: d('2026-10-21T09:40') }),
  m({ number: 8, title: 'Exportar coletas do mês em CSV', description: 'Exportar as coletas do mês em CSV para conciliar com a planilha financeira.', category: 'melhoria', status: 'nova', createdAt: d('2026-10-29T17:25'), updatedAt: d('2026-10-29T17:25') }),
  m({ number: 9, title: 'Notificação quando laudo é liberado', description: 'Receber um aviso por e-mail quando um laudo for liberado no portal.', category: 'melhoria', status: 'em_triagem', source: 'admin', authorLabel: 'Bruno Saraiva', authorUserId: bruno.id, createdAt: d('2026-10-24T10:00'), updatedAt: d('2026-10-24T10:00') }),
]).returning();
const MA = Object.fromEntries(maReqs.map((x) => [x.number, x]));

// ---------- eventos (histórico) ----------
type Ev = typeof schema.requestEvents.$inferInsert;
const events: Ev[] = [];
for (const req of [...ceReqs, ...maReqs]) {
  events.push({ requestId: req.id, actorLabel: req.authorLabel, type: 'criada', toValue: req.source, isPublic: true, createdAt: req.createdAt! });
  if (req.assigneeUserId) {
    const who = req.assigneeUserId === ana.id ? 'Ana Ribeiro' : 'Bruno Saraiva';
    events.push({ requestId: req.id, actorLabel: 'Helena Prado', type: 'responsavel', toValue: who, isPublic: false, createdAt: new Date(req.createdAt!.getTime() + 3_600_000) });
  }
  if (req.status !== 'nova') {
    events.push({ requestId: req.id, actorLabel: 'Ana Ribeiro', type: 'status', fromValue: 'nova', toValue: req.status === 'concluida' || req.status === 'cancelada' ? 'em_andamento' : req.status, isPublic: true, createdAt: new Date(req.createdAt!.getTime() + 2 * 86_400_000) });
  }
  if (req.closedAt) {
    events.push({ requestId: req.id, actorLabel: req.assigneeUserId === bruno.id ? 'Bruno Saraiva' : 'Ana Ribeiro', type: 'status', fromValue: 'em_andamento', toValue: req.status, note: req.status === 'cancelada' ? 'Cadastro duplicado já tratado na solicitação CE-3.' : undefined, isPublic: true, createdAt: req.closedAt });
  }
}
await db.insert(schema.requestEvents).values(events);

// ---------- comentários públicos e internos ----------
await db.insert(schema.requestComments).values([
  { requestId: CE[1].id, authorUserId: ana.id, authorLabel: 'Ana Ribeiro', visibility: 'public', body: 'Reproduzimos o erro com complemento acima de 30 caracteres. Correção em andamento.', createdAt: d('2026-06-05T10:00') },
  { requestId: CE[1].id, authorUserId: ana.id, authorLabel: 'Ana Ribeiro', visibility: 'internal', body: 'Nota interna: o campo complemento estava limitado a 30 caracteres no banco; ampliado para 120 e validado no formulário.', createdAt: d('2026-06-05T10:02') },
  { requestId: CE[1].id, authorUserId: joao.id, authorLabel: 'João Pereira', visibility: 'public', body: 'Testamos na obra hoje e salvou normalmente. Obrigado!', createdAt: d('2026-06-19T15:40') },
  { requestId: CE[4].id, authorUserId: ana.id, authorLabel: 'Ana Ribeiro', visibility: 'public', body: 'Primeira versão do relatório está em validação interna; previsão de liberar para teste em breve.', createdAt: d('2026-10-28T09:30') },
  { requestId: CE[4].id, authorUserId: helena.id, authorLabel: 'Helena Prado', visibility: 'internal', body: 'Nota interna: alinhar com a diretoria do cliente se o relatório entra no escopo do contrato atual.', createdAt: d('2026-10-28T09:35') },
  { requestId: CE[9].id, authorUserId: ana.id, authorLabel: 'Ana Ribeiro', visibility: 'internal', body: 'Nota interna: a lentidão vem de uma consulta sem índice em itens_orcamento. Testar índice composto antes de mexer na tela.', createdAt: d('2026-10-30T15:45') },
  { requestId: CE[10].id, authorUserId: ana.id, authorLabel: 'Ana Ribeiro', visibility: 'public', body: 'O campo deve ser livre ou com opções pré-definidas (ex.: pendência elétrica, hidráulica, estrutural)? Aguardamos sua orientação.', createdAt: d('2026-10-27T16:00') },
  { requestId: CE[6].id, authorUserId: ana.id, authorLabel: 'Ana Ribeiro', visibility: 'public', body: 'Fica em Agenda > menu "..." > Exportar semana (.xlsx). Enviamos um print em anexo.', createdAt: d('2026-09-23T09:10') },
  { requestId: MA[7].id, authorUserId: bruno.id, authorLabel: 'Bruno Saraiva', visibility: 'public', body: 'Para reproduzir, pode informar o modelo do tablet e a versão do sistema? Assim testamos no mesmo cenário.', createdAt: d('2026-10-21T09:40') },
  { requestId: MA[7].id, authorUserId: bruno.id, authorLabel: 'Bruno Saraiva', visibility: 'internal', body: 'Nota interna: provável Android 8 com navegador antigo; avaliar fallback de rolagem horizontal.', createdAt: d('2026-10-21T09:42') },
  { requestId: MA[1].id, authorUserId: otavio.id, authorLabel: 'Otávio Reis', visibility: 'public', body: 'Confirmado, o menu abre no celular agora.', createdAt: d('2026-07-24T17:00') },
  { requestId: MA[3].id, authorUserId: bruno.id, authorLabel: 'Bruno Saraiva', visibility: 'public', body: 'Agora a mensagem informa o motivo (tamanho, formato ou conexão) e o limite de 10 MB.', createdAt: d('2026-08-29T16:05') },
]);

// ---------- anexos fictícios (gerados localmente) ----------
function pngFile(filePath: string, w: number, h: number, color: [number, number, number], accent: [number, number, number]) {
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const bar = (y > h * 0.2 && y < h * 0.3) || (x > w * 0.1 && x < w * 0.14 && y > h * 0.35) || (y > h * 0.5 && y < h * 0.52);
      const [r0, g0, b0] = bar ? accent : color;
      row.writeUInt8(r0, 1 + x * 3); row.writeUInt8(g0, 2 + x * 3); row.writeUInt8(b0, 3 + x * 3);
    }
    rows.push(row);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(filePath, png);
  return png.length;
}
const uploads = (clientId: string) => { const dir = path.resolve(env.UPLOAD_DIR, clientId); mkdirSync(dir, { recursive: true }); return dir; };
const ceDir = uploads(cidade.id), maDir = uploads(marca.id);
const f1 = path.join(ceDir, 'seed-print-cadastro-visitas.png'); const s1 = pngFile(f1, 640, 360, [247, 246, 240], [255, 107, 61]);
const f2 = path.join(ceDir, 'seed-print-exportar-agenda.png'); const s2 = pngFile(f2, 640, 360, [247, 246, 240], [23, 22, 15]);
const f3 = path.join(ceDir, 'seed-evidencia-busca-visitas.png'); const s3 = pngFile(f3, 800, 450, [255, 241, 235], [255, 107, 61]);
const f4 = path.join(maDir, 'seed-print-tablet-tabela.png'); const s4 = pngFile(f4, 640, 360, [247, 246, 240], [255, 107, 61]);
const f5 = path.join(maDir, 'seed-formatos-aceitos.txt'); const t5 = 'Formatos aceitos no upload (dado fictício de demonstração):\nPDF, PNG, JPG, XLSX, DOCX, CSV\n'; writeFileSync(f5, t5);
const [attCe1, , attCe3, attMa7] = await db.insert(schema.attachments).values([
  { clientId: cidade.id, requestId: CE[1].id, fileName: 'print-erro-cadastro-visita.png', mimeType: 'image/png', sizeBytes: s1, storagePath: f1, uploadedByLabel: 'Ana Ribeiro', createdAt: d('2026-06-02T09:45') },
  { clientId: cidade.id, requestId: CE[6].id, fileName: 'print-exportar-agenda.png', mimeType: 'image/png', sizeBytes: s2, storagePath: f2, uploadedByLabel: 'Ana Ribeiro', createdAt: d('2026-09-23T09:10') },
  { clientId: cidade.id, fileName: 'evidencia-busca-por-obra.png', mimeType: 'image/png', sizeBytes: s3, storagePath: f3, uploadedByLabel: 'Ana Ribeiro', createdAt: d('2026-09-10T10:00') },
  { clientId: marca.id, requestId: MA[7].id, fileName: 'foto-tablet-tabela-residuos.png', mimeType: 'image/png', sizeBytes: s4, storagePath: f4, uploadedByLabel: 'Otávio Reis', createdAt: d('2026-10-09T13:05') },
  { clientId: marca.id, fileName: 'formatos-aceitos.txt', mimeType: 'text/plain', sizeBytes: Buffer.byteLength(t5), storagePath: f5, uploadedByLabel: 'Bruno Saraiva', createdAt: d('2026-08-30T09:00') },
]).returning();
await db.insert(schema.requestEvents).values([
  { requestId: CE[1].id, actorLabel: 'Ana Ribeiro', type: 'anexo', toValue: 'print-erro-cadastro-visita.png', isPublic: true, createdAt: d('2026-06-02T09:45') },
  { requestId: MA[7].id, actorLabel: 'Otávio Reis', type: 'anexo', toValue: 'foto-tablet-tabela-residuos.png', isPublic: true, createdAt: d('2026-10-09T13:05') },
]);

// ---------- entregas, vínculos e evidências ----------
const dv = (over: Partial<typeof schema.deliveries.$inferInsert> & Pick<typeof schema.deliveries.$inferInsert, 'title' | 'summary' | 'deliveredAt'>): typeof schema.deliveries.$inferInsert => ({
  clientId: cidade.id, projectId: ceGestao.id, status: 'publicada', ownerUserId: ana.id, ownerLabel: 'Ana Ribeiro', publishedAt: over.deliveredAt, createdAt: over.deliveredAt, updatedAt: over.deliveredAt, ...over,
});
const [ceD1, ceD2, ceD3, ceD4, ceD5, maD1, maD2, maD3] = await db.insert(schema.deliveries).values([
  dv({ title: 'Cadastro de visitas mais confiável', summary: 'O cadastro de visitas passou a aceitar endereços com complemento longo sem perder os dados digitados.', details: 'Ampliamos o limite do campo complemento e passamos a validar o formulário antes do envio, mostrando o erro no próprio campo.', deliveredAt: d('2026-06-19T16:00') }),
  dv({ title: 'Busca e ordenação de visitas', summary: 'A listagem de visitas ganhou filtro por obra e passou a mostrar as visitas mais recentes primeiro.', details: 'Filtro por obra com busca por nome, ordenação padrão por data decrescente e memorização do último filtro usado.', deliveredAt: d('2026-09-10T10:00') }),
  dv({ title: 'Fluxo de aprovação de orçamentos', summary: 'O gestor aprova ou devolve orçamentos dentro da plataforma, com registro de quem aprovou e quando.', details: 'Nova etapa "Aguardando aprovação" com histórico e notificação para o solicitante.', deliveredAt: d('2026-08-28T09:00') }),
  dv({ title: 'Correção do anexo de fotos no app de campo', summary: 'Fotos da visita voltam a ser enviadas com segurança, inclusive em celulares com pouca memória.', details: 'Compressão da imagem no aparelho antes do envio e nova tentativa automática em caso de falha de rede.', projectId: ceCampo.id, deliveredAt: d('2026-10-15T09:00') }),
  dv({ title: 'Relatório de visitas por engenheiro', summary: 'Relatório mensal por engenheiro, com filtro por obra e período.', status: 'rascunho', publishedAt: null, deliveredAt: d('2026-11-02T18:00') }),
  dv({ clientId: marca.id, projectId: maPortal.id, ownerUserId: bruno.id, ownerLabel: 'Bruno Saraiva', title: 'Navegação mobile reconstruída', summary: 'O menu do portal passou a funcionar em celulares, com navegação por toque e atalhos para documentos e laudos.', details: 'Menu lateral recriado com componentes responsivos e testado nos navegadores mais usados pelas equipes.', deliveredAt: d('2026-07-25T11:00') }),
  dv({ clientId: marca.id, projectId: maPortal.id, ownerUserId: bruno.id, ownerLabel: 'Bruno Saraiva', title: 'Upload de documentos ampliado e com mensagens claras', summary: 'O upload aceita fotos, planilhas e documentos além de PDF, e os erros explicam o motivo e o limite de tamanho.', details: 'Validação de formato e tamanho no navegador e no servidor, com mensagens específicas por causa.', deliveredAt: d('2026-08-30T09:00') }),
  dv({ clientId: marca.id, projectId: maPortal.id, ownerUserId: bruno.id, ownerLabel: 'Bruno Saraiva', title: 'Histórico de coletas por unidade', summary: 'Linha do tempo de coletas por unidade geradora com laudos vinculados.', status: 'rascunho', publishedAt: null, deliveredAt: d('2026-11-01T10:00') }),
]).returning();
await db.update(schema.attachments).set({ deliveryId: ceD2.id }).where(eq(schema.attachments.id, attCe3.id));
await db.update(schema.attachments).set({ deliveryId: maD2.id }).where(eq(schema.attachments.storagePath, f5));
await db.insert(schema.deliveryRequests).values([
  { deliveryId: ceD1.id, requestId: CE[1].id },
  { deliveryId: ceD2.id, requestId: CE[2].id }, { deliveryId: ceD2.id, requestId: CE[5].id },
  { deliveryId: ceD3.id, requestId: CE[3].id },
  { deliveryId: ceD4.id, requestId: CE[7].id },
  { deliveryId: ceD5.id, requestId: CE[4].id },
  { deliveryId: maD1.id, requestId: MA[1].id },
  { deliveryId: maD2.id, requestId: MA[2].id }, { deliveryId: maD2.id, requestId: MA[3].id },
  { deliveryId: maD3.id, requestId: MA[5].id },
]);
const linkPairs: [typeof ceD1, typeof CE[1]][] = [
  [ceD1, CE[1]], [ceD2, CE[2]], [ceD2, CE[5]], [ceD3, CE[3]], [ceD4, CE[7]], [maD1, MA[1]], [maD2, MA[2]], [maD2, MA[3]],
];
const linkEvents: Ev[] = linkPairs.map(([dlv, req]) => ({ requestId: req.id, actorLabel: dlv.ownerLabel, type: 'entrega_publicada', toValue: dlv.title, note: dlv.id, isPublic: true, createdAt: dlv.publishedAt! }));
await db.insert(schema.requestEvents).values(linkEvents);
await db.insert(schema.valueEvidences).values([
  { deliveryId: ceD1.id, kind: 'observado', title: 'Erro de salvamento não ocorre mais nos cenários testados', description: 'Testado com 12 endereços reais de obras (dados fictícios de demonstração), incluindo complementos com mais de 60 caracteres.', sourceLabel: 'Teste conjunto com a equipe de campo', attachmentId: attCe1.id },
  { deliveryId: ceD1.id, kind: 'esperado', title: 'Menos retrabalho ao cadastrar visitas', description: 'Com o formulário não perdendo dados, espera-se reduzir recadastros. Ainda sem medição formal.' },
  { deliveryId: ceD2.id, kind: 'observado', title: 'Visita localizada pelo nome da obra sem rolar a lista', description: 'Demonstrado em reunião com a equipe administrativa.', sourceLabel: 'Reunião de validação (fictícia)', attachmentId: attCe3.id },
  { deliveryId: ceD2.id, kind: 'medido', title: 'Uso do filtro por obra', description: 'Quantidade de buscas registradas pela plataforma no primeiro mês após a publicação.', metricValue: '148', metricUnit: 'buscas em 30 dias', sourceLabel: 'Registro de uso da plataforma (dado fictício de demonstração)' },
  { deliveryId: ceD3.id, kind: 'observado', title: 'Aprovação registrada na plataforma, sem e-mail paralelo', description: 'A diretoria passou a aprovar orçamentos diretamente na etapa nova.', sourceLabel: 'Relato do cliente em reunião' },
  { deliveryId: ceD3.id, kind: 'medido', title: 'Orçamentos aprovados pela nova etapa', description: 'Contagem de orçamentos com aprovação registrada no primeiro mês.', metricValue: '23', metricUnit: 'orçamentos em 30 dias', sourceLabel: 'Banco da plataforma de gestão (dado fictício de demonstração)' },
  { deliveryId: ceD3.id, kind: 'esperado', title: 'Rastreabilidade de quem aprovou e quando', description: 'Benefício esperado para auditoria interna; não medido.' },
  { deliveryId: ceD4.id, kind: 'observado', title: 'Fotos enviadas com sucesso em aparelhos de teste', description: 'Validado em 3 modelos de celular usados pelas equipes.', sourceLabel: 'Teste em campo com dois engenheiros' },
  { deliveryId: maD1.id, kind: 'observado', title: 'Menu abre e navega em celulares Android e iOS', sourceLabel: 'Confirmado pelo cliente na solicitação MA-1' },
  { deliveryId: maD1.id, kind: 'esperado', title: 'Equipes consultam laudos pelo celular sem ir ao escritório', description: 'Benefício esperado; sem medição formal.' },
  { deliveryId: maD2.id, kind: 'medido', title: 'Formatos aceitos no upload', description: 'De 1 formato (PDF) para 6 formatos.', metricValue: '6', metricUnit: 'formatos', sourceLabel: 'Configuração publicada (anexo)' },
  { deliveryId: maD2.id, kind: 'observado', title: 'Mensagens de erro específicas por causa', description: 'Tamanho, formato e conexão passaram a ser informados ao usuário.' },
]);

// ---------- apresentações geradas pela mesma regra de negócio ----------
const adminActor: Actor = { kind: 'user', id: helena.id, userId: helena.id, label: 'Helena Prado', role: 'admin_optsolv', clientIds: 'all' };
const pCe = await generatePresentation(adminActor, { clientId: cidade.id, periodStart: d('2026-05-01T00:00'), periodEnd: d('2026-10-31T23:59'), title: 'Cidade Engenharia · Resultados maio a outubro de 2026' });
await updatePresentation(adminActor, pCe.id, { status: 'compartilhada' });
const pMa = await generatePresentation(adminActor, { clientId: marca.id, periodStart: d('2026-06-01T00:00'), periodEnd: d('2026-10-31T23:59'), title: 'Marca Ambiental · Resultados junho a outubro de 2026' });
await updatePresentation(adminActor, pMa.id, { status: 'compartilhada' });

await db.insert(schema.auditLogs).values({ actorLabel: 'seed', actorKind: 'system', action: 'seed.apply', entityType: 'database', entityId: null, clientId: null, meta: { clients: 2, requests: ceReqs.length + maReqs.length } });

log(`Seed aplicado.
Contas (senha: ${PASSWORD}):
  admin@optsolv.demo              Helena Prado   · admin_optsolv (todos os clientes)
  ana@optsolv.demo                Ana Ribeiro    · colaborador (Cidade + Marca)
  bruno@optsolv.demo              Bruno Saraiva  · colaborador (Marca)
  joao@cidadeengenharia.demo      João Pereira   · cliente Cidade Engenharia
  marina@cidadeengenharia.demo    Marina Lobo    · cliente Cidade Engenharia
  otavio@marcaambiental.demo      Otávio Reis    · cliente Marca Ambiental
Tokens de API/MCP (demo):
  ${DEMO_TOKENS.agenteCidade}  (colaborador, escopo Cidade Engenharia)
  ${DEMO_TOKENS.adminTotal}  (admin, todos os clientes)`);
return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runSeed();
  await pool.end();
}
