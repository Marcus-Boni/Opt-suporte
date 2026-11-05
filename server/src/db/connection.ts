/**
 * Conexão com o Postgres: um lugar só para TLS, timeouts e travas de segurança.
 * Vale para o banco local (Docker) e para o Azure Database for PostgreSQL (flexible server).
 */
import type { PoolConfig } from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'db', 'postgres']);

export function isLocalDatabase(url: string) {
  try { return LOCAL_HOSTS.has(new URL(url).hostname); } catch { return false; }
}

/** "host/banco" sem usuário nem senha, para logs e mensagens. */
export function describeDatabase(url: string) {
  try { const u = new URL(url); return `${u.hostname}${u.pathname}`; } catch { return '(DATABASE_URL inválida)'; }
}

export const databaseName = (url: string) => decodeURIComponent(new URL(url).pathname.slice(1));

/**
 * Configuração do pool. Fora do localhost o TLS é obrigatório e o certificado é verificado
 * (o Azure usa cadeias DigiCert/Microsoft presentes no Node). `sslmode=disable` só para uso local;
 * `sslmode=no-verify` existe para diagnóstico e não deve ser usado em produção.
 */
export function poolConfig(url: string, overrides: Partial<PoolConfig> = {}): PoolConfig {
  const u = new URL(url);
  const sslmode = u.searchParams.get('sslmode');
  // Os parâmetros sslmode/sslrootcert da URL têm semântica diferente no driver `pg`; a decisão fica explícita aqui.
  for (const k of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) u.searchParams.delete(k);
  const ssl = sslmode === 'disable' || (!sslmode && isLocalDatabase(url)) ? false : { rejectUnauthorized: sslmode !== 'no-verify' };
  return {
    connectionString: u.toString(),
    ssl,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    application_name: 'optsolv-suporte',
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 30_000),
    idle_in_transaction_session_timeout: 60_000,
    ...overrides,
  };
}

/**
 * Trava para operações destrutivas ou de demonstração (reset, seed, testes).
 * Banco local passa direto; banco remoto exige CONFIRM_DATABASE=<nome do banco>, digitado de propósito.
 */
export function assertDisposableDatabase(url: string, action: string) {
  if (isLocalDatabase(url)) return;
  const name = databaseName(url);
  if (process.env.CONFIRM_DATABASE === name) return;
  throw new Error(`${action} recusado em ${describeDatabase(url)}: não é um banco local. `
    + `Se este banco for mesmo descartável (ex.: homologação), rode de novo com CONFIRM_DATABASE=${name}.`);
}
