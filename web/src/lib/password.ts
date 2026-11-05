/**
 * Força de senha estimada no navegador, sem dependência: entropia pelo tamanho e variedade de caracteres,
 * com penalidade para padrões que ataques testam primeiro (senhas comuns, sequências, repetições, nome/e-mail).
 * shortcut: heurística própria; se precisar de estimativa por dicionário completo, trocar por zxcvbn-ts.
 */
export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; checks: { id: string; label: string; ok: boolean }[]; acceptable: boolean };

export const MIN_PASSWORD = 12;
export const STRENGTH_LABELS = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Muito forte'] as const;

const COMMON = ['senha', 'password', 'qwerty', 'asdf', 'zxcv', 'abc123', 'admin', 'optsolv', 'suporte', 'brasil', 'mudar', 'trocar', 'iloveyou', 'welcome', 'letmein', '102030', '123456', '654321', '111111', '000000'];
const SEQ = 'abcdefghijklmnopqrstuvwxyz01234567890';

function hasSequence(s: string) {
  const l = s.toLowerCase();
  for (let i = 0; i + 4 <= l.length; i++) {
    const part = l.slice(i, i + 4);
    if (SEQ.includes(part) || SEQ.split('').reverse().join('').includes(part)) return true;
  }
  return false;
}

export function passwordStrength(pw: string, hints: string[] = []): Strength {
  const lower = /[a-z]/.test(pw), upper = /[A-Z]/.test(pw), digit = /\d/.test(pw), symbol = /[^A-Za-z0-9]/.test(pw);
  const low = pw.toLowerCase();
  // Partes do nome e do e-mail (3+ letras) dentro da senha contam como palavra conhecida.
  const personal = hints.flatMap((h) => h.toLowerCase().split(/[^a-zà-ú0-9]+/i)).filter((p) => p.length >= 3);
  const usesKnown = COMMON.some((c) => low.includes(c)) || personal.some((p) => low.includes(p));
  const repeats = /(.)\1{2,}/.test(pw);
  const sequence = hasSequence(pw);

  const pool = (lower ? 26 : 0) + (upper ? 26 : 0) + (digit ? 10 : 0) + (symbol ? 33 : 0);
  let bits = pw.length * Math.log2(Math.max(pool, 1));
  if (usesKnown) bits -= 24;
  if (repeats) bits -= 10;
  if (sequence) bits -= 24;

  let score: Strength['score'] = bits < 28 ? 0 : bits < 45 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  if (pw.length < MIN_PASSWORD || usesKnown) score = Math.min(score, 1) as Strength['score'];
  if (!pw) score = 0;

  const checks = [
    { id: 'len', label: `${MIN_PASSWORD}+ caracteres`, ok: pw.length >= MIN_PASSWORD },
    { id: 'case', label: 'Maiúsculas e minúsculas', ok: lower && upper },
    { id: 'digit', label: 'Números', ok: digit },
    { id: 'symbol', label: 'Símbolos', ok: symbol },
    { id: 'known', label: 'Sem nome, e-mail ou senha comum', ok: !!pw && !usesKnown && !sequence && !repeats },
  ];
  return { score, label: STRENGTH_LABELS[score], checks, acceptable: pw.length >= MIN_PASSWORD && score >= 2 };
}

const SETS = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*?-_+='];

/** Senha aleatória com todas as classes, sem caracteres ambíguos (0/O, 1/l/I). Usa crypto.getRandomValues. */
export function generatePassword(length = 18) {
  const all = SETS.join('');
  const rnd = (n: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const chars = SETS.map((s) => s[rnd(s.length)]);
  while (chars.length < length) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}
