import { HttpError } from './errors.js';

/**
 * Limite por chave em janela fixa (ex.: tentativas de login, chamadas à IA).
 * shortcut: contador em memória por processo, suficiente para uma instância; trocar por Redis ao escalar horizontalmente.
 */
export function createLimiter(max: number, windowMs: number, message: string) {
  const hits = new Map<string, { n: number; until: number }>();
  return {
    /** Lança 429 se a chave já atingiu o limite na janela atual. */
    check(key: string) {
      const a = hits.get(key);
      if (a && a.n >= max && Date.now() < a.until) {
        throw new HttpError(429, 'too_many_requests', message, { retryAfterSeconds: Math.ceil((a.until - Date.now()) / 1000) });
      }
    },
    hit(key: string) {
      const now = Date.now();
      // Evita crescer sem limite com chaves novas (ex.: varredura de e-mails): descarta janelas vencidas.
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
      const a = hits.get(key);
      hits.set(key, a && now < a.until ? { n: a.n + 1, until: a.until } : { n: 1, until: now + windowMs });
    },
    reset(key: string) { hits.delete(key); },
  };
}
