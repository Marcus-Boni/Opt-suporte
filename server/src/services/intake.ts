import { db, schema } from '../db/index.js';
import { assertClient, assertInternal, type Actor } from '../auth/actor.js';
import { badRequest } from '../lib/errors.js';
import { audit } from './audit.js';
import { getProject } from './clients.js';
import { createRequest, deriveTitle, openRequestsForClient, type RequestCategory, type RequestPriority } from './requests.js';

/**
 * Captura assistida de WhatsApp — modo demonstração determinístico.
 * Não há conexão com grupos nem IA externa: tudo é heurística local, revisada por uma pessoa antes de gravar.
 */
export const ANALYSIS_MODE = 'demo-deterministico';

type Message = { sender: string; sentAt: string | null; text: string };

const HEADER = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–]?\s*([^:]{1,60}):\s(.*)$/;

export function parseWhatsApp(raw: string): Message[] {
  const messages: Message[] = [];
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const m = line.match(HEADER);
    if (m) {
      messages.push({ sender: m[3].trim(), sentAt: toIso(m[1], m[2]), text: m[4].trim() });
    } else if (line.trim()) {
      if (messages.length) messages[messages.length - 1].text += '\n' + line.trim();
      else messages.push({ sender: 'Desconhecido', sentAt: null, text: line.trim() });
    }
  }
  return messages;
}

function toIso(date: string, time: string) {
  const [d, m, y] = date.split('/').map(Number);
  const year = y < 100 ? 2000 + y : y;
  const [hh, mm, ss = 0] = time.split(':').map(Number);
  const dt = new Date(year, m - 1, d, hh, mm, ss);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

const NOISE = /^(ok+|okay|obrigad[oa]s?|valeu|bom dia|boa tarde|boa noite|beleza|blz|certo|perfeito|show|top|👍|kk+|haha+|sim|não|nao|combinado|entendi|vou ver|já vi|ja vi|opa|oi|olá|ola)( pessoal| galera| equipe| time| gente| a todos| todos)?[.!,\s]*$/iu;
const isNoise = (text: string) => text.trim().length < 12 || NOISE.test(text.trim()) || /^[\p{Emoji}\s]+$/u.test(text.trim());

/** Mensagens consecutivas do mesmo remetente em até 10 minutos viram um único bloco; cortesias não se fundem a nada. */
function groupBlocks(messages: Message[]) {
  const blocks: (Message & { noise: boolean })[] = [];
  for (const msg of messages) {
    const noise = isNoise(msg.text);
    const last = blocks[blocks.length - 1];
    const close = last && !last.noise && !noise && last.sender === msg.sender && last.sentAt && msg.sentAt
      && Math.abs(new Date(msg.sentAt).getTime() - new Date(last.sentAt).getTime()) < 10 * 60_000;
    if (close) last.text += '\n' + msg.text;
    else blocks.push({ ...msg, noise });
  }
  return blocks;
}

const STOP = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'um', 'uma', 'para', 'pra', 'com', 'que', 'não', 'nao', 'na', 'no', 'os', 'as', 'se', 'por', 'ao', 'à', 'é', 'the', 'tá', 'ta', 'está', 'esta', 'tem', 'foi', 'ser', 'mais', 'muito', 'quando', 'como', 'isso', 'esse', 'essa', 'ele', 'ela', 'aqui', 'lá', 'gente', 'pessoal', 'bom', 'dia', 'tarde']);

const tokens = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)));
export function similarity(a: string, b: string) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

const RULES: { category: RequestCategory; re: RegExp }[] = [
  { category: 'problema', re: /(\berro|\bbug|\bfalha|travou|trava\b|quebrou|(não|nao) (abre|carrega|funciona|salva|aparece|consigo)|(ninguém|ninguem|não|nao) consegu|\bparou|\bcaiu|\blent[oa]|\bdemora|fora do ar|inconsist|duplicad|\bsumiu|\bsome\b|perde(u)? (os )?dados)/i },
  { category: 'nova_funcionalidade', re: /\b(nova (tela|funcionalidade|opção|opcao|aba)|criar|adicionar|incluir|precisamos de um|queria um|ter um|relatório novo|novo (relatório|relatorio|campo|botão|botao|módulo|modulo))\b/i },
  { category: 'duvida', re: /\?\s*$|\b(como (faço|faco|faz)|onde (fica|encontro|vejo)|é possível|e possivel|dúvida|duvida|alguém sabe|alguem sabe)\b/i },
  { category: 'melhoria', re: /\b(melhorar|seria bom|poderia|podia|facilitar|ficaria melhor|sugest|ajustar|organizar|filtro|ordenar)\b/i },
];
const URGENT = /\b(urgente|urgência|urgencia|crítico|critico|parad[oa]|bloqueado|hoje|ninguém consegue|ninguem consegue|produção parada|producao parada|cliente esperando)\b/i;
const LOW = /\b(sem pressa|quando der|quando puder|não é urgente|nao e urgente|futuramente|um dia)\b/i;

export function classify(text: string) {
  const category = RULES.find((r) => r.re.test(text))?.category ?? 'melhoria';
  const priority: RequestPriority = URGENT.test(text) ? 'alta' : LOW.test(text) ? 'baixa' : 'media';
  const confidence = RULES.some((r) => r.re.test(text)) ? 0.8 : 0.5;
  return { category, priority, confidence };
}

export type Suggestion = {
  index: number; sender: string; sentAt: string | null; excerpt: string;
  title: string; description: string; category: RequestCategory; priority: RequestPriority; confidence: number;
  ignored?: string;
  duplicateOf?: { requestId: string; number: number; title: string; score: number };
  similarTo?: { index: number; score: number };
};

export async function previewWhatsApp(actor: Actor, input: { clientId: string; projectId?: string; text: string }) {
  assertInternal(actor);
  assertClient(actor, input.clientId, 'Cliente');
  if (input.projectId) await getProject(actor, input.projectId);
  if (!input.text.trim()) throw badRequest('Cole o texto das mensagens.');
  const blocks = groupBlocks(parseWhatsApp(input.text));
  const existing = await openRequestsForClient(actor, input.clientId);
  const suggestions: Suggestion[] = blocks.map((b, index) => {
    const { category, priority, confidence } = classify(b.text);
    // Título e descrição ignoram linhas de saudação no início do bloco ("Bom dia pessoal").
    const lines = b.text.split('\n');
    const meaningful = lines.filter((l) => !isNoise(l));
    const body = (meaningful.length ? meaningful : lines).join('\n');
    const s: Suggestion = {
      index, sender: b.sender, sentAt: b.sentAt, excerpt: b.text, title: deriveTitle(body), description: body, category, priority, confidence,
    };
    if (b.noise) s.ignored = 'Mensagem curta ou de cortesia, sem demanda identificável.';
    return s;
  });
  for (const s of suggestions) {
    if (s.ignored) continue;
    let best: Suggestion['duplicateOf'] | undefined;
    for (const r of existing) {
      const score = similarity(s.excerpt, `${r.title} ${r.description}`);
      if (score >= 0.3 && (!best || score > best.score)) best = { requestId: r.id, number: r.number, title: r.title, score: Math.round(score * 100) / 100 };
    }
    if (best) s.duplicateOf = best;
    for (const other of suggestions) {
      if (other.index >= s.index || other.ignored) continue;
      const score = similarity(s.excerpt, other.excerpt);
      if (score >= 0.5 && (!s.similarTo || score > s.similarTo.score)) s.similarTo = { index: other.index, score: Math.round(score * 100) / 100 };
    }
  }
  return { mode: ANALYSIS_MODE, messageCount: blocks.length, suggestions };
}

export type CommitItem = { title: string; description: string; category: RequestCategory; priority: RequestPriority; sender: string; sentAt?: string | null; excerpt: string };

export async function commitWhatsApp(actor: Actor, input: { clientId: string; projectId: string; rawText: string; items: CommitItem[] }) {
  assertInternal(actor);
  const project = await getProject(actor, input.projectId);
  if (project.clientId !== input.clientId) throw badRequest('Projeto não pertence ao cliente informado.');
  if (!input.items.length) throw badRequest('Selecione ao menos uma sugestão para registrar.');
  const [source] = await db.insert(schema.sourceMessages).values({
    clientId: input.clientId, projectId: input.projectId, rawText: input.rawText, analysisMode: ANALYSIS_MODE, createdByLabel: actor.label,
  }).returning();
  const created = [];
  for (const item of input.items) {
    const { request } = await createRequest(actor, {
      projectId: input.projectId, title: item.title, description: item.description, category: item.category, priority: item.priority,
      source: 'captura_whatsapp', authorLabel: `${item.sender} (via WhatsApp)`, sourceMessageId: source.id, sourceExcerpt: item.excerpt,
    });
    created.push(request);
  }
  await audit(actor, 'intake.whatsapp.commit', 'source_message', source.id, input.clientId, { created: created.length });
  return { sourceMessageId: source.id, created };
}
