/**
 * Avaliação da captura com IA contra um gabarito rotulado (scripts/intake-eval.json).
 * Chama o Foundry de verdade (Entra ID): use para comparar implantações e validar mudanças de prompt.
 *
 *   pnpm --filter server ai:eval                 (implantação de AZURE_OPENAI_DEPLOYMENT)
 *   AZURE_OPENAI_DEPLOYMENT=gpt-6.1-sol pnpm --filter server ai:eval
 */
import { readFileSync } from 'node:fs';
import { analyzeBlocks, maskPii, PROMPT_VERSION } from '../src/services/intake-ai.js';
import { classify } from '../src/services/intake.js';
import { env } from '../src/env.js';

type Case = { text: string; actionable: boolean; category?: string; priorityAtLeast?: string };
const { cases } = JSON.parse(readFileSync(new URL('./intake-eval.json', import.meta.url), 'utf8')) as { cases: Case[] };
const RANK = { baixa: 0, media: 1, alta: 2, critica: 3 } as const;

const res = await analyzeBlocks(cases.map((c, index) => ({ index, text: c.text })));
if (!res.ok) throw new Error(`IA indisponível: ${res.reason}`);

let actOk = 0, catOk = 0, catTotal = 0, prioOk = 0, prioTotal = 0, heurCat = 0;
const rows = cases.map((c, i) => {
  const it = res.items.get(i);
  if (res.filtered.has(i)) return { '#': i, demanda: 'filtro de segurança (fica com as regras)', categoria: '-', prioridade: '-', conf: '-', titulo: c.text.slice(0, 50) };
  const a = it?.actionable === c.actionable; if (a) actOk++;
  let cat = '';
  if (c.category) { catTotal++; if (it?.category === c.category) { catOk++; cat = 'ok'; } else cat = `esperado ${c.category}`; if (classify(c.text).category === c.category) heurCat++; }
  if (c.priorityAtLeast && it) { prioTotal++; if (RANK[it.priority] >= RANK[c.priorityAtLeast as keyof typeof RANK]) prioOk++; }
  return { '#': i, demanda: `${it?.actionable ? 'sim' : 'não'}${a ? '' : ' ✗'}`, categoria: `${it?.category ?? '-'}${cat && cat !== 'ok' ? ` ✗ (${cat})` : ''}`, prioridade: it?.priority, conf: it?.confidence, titulo: it?.title || it?.ignoredReason };
});
console.table(rows);
const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}% (${n}/${d})`;
console.log(`Implantação: ${env.AZURE_OPENAI_DEPLOYMENT} · modelo ${res.model} · prompt ${PROMPT_VERSION}`);
console.log(`Há demanda?: ${pct(actOk, cases.length)} · Categoria: ${pct(catOk, catTotal)} (heurística: ${pct(heurCat, catTotal)}) · Urgência: ${pct(prioOk, prioTotal)}`);
console.log(`Tempo: ${res.ms} ms · tokens: ${res.usage.totalTokens} (entrada ${res.usage.inputTokens}, saída ${res.usage.outputTokens})`);
console.log(`Privacidade: o texto enviado do caso 10 foi → ${maskPii(cases[10].text)}`);
