import 'dotenv/config';

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://optsolv:optsolv@127.0.0.1:5434/optsolv_experience',
  PORT: Number(process.env.PORT ?? 4000),
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'segredo-local-inseguro',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  // Quantos proxies confiáveis há na frente da API (ex.: 1 no Azure Container Apps/App Service). Sem isso o IP real
  // do cliente não chega e os limites de login valem para todos juntos. 0 = acesso direto.
  TRUST_PROXY: Number(process.env.TRUST_PROXY ?? 0),
  // IA (Microsoft Foundry / Azure OpenAI). Sem endpoint, a captura usa só as heurísticas locais.
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT ?? '',
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-6.1-sol', // escolhido pela avaliação (scripts/ai-eval.ts)
  AI_INTAKE_ENABLED: process.env.AI_INTAKE_ENABLED !== 'false',
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS ?? 30_000),
  // Login da equipe com Microsoft Entra ID (OIDC). Sem os três primeiros, só e-mail e senha.
  ENTRA_TENANT_ID: process.env.ENTRA_TENANT_ID ?? '',
  ENTRA_CLIENT_ID: process.env.ENTRA_CLIENT_ID ?? '',
  ENTRA_CLIENT_SECRET: process.env.ENTRA_CLIENT_SECRET ?? '',
  ENTRA_AUTHORITY: process.env.ENTRA_AUTHORITY ?? '', // vazio = https://login.microsoftonline.com/<tenant>/v2.0
  ENTRA_REDIRECT_URI: process.env.ENTRA_REDIRECT_URI ?? `http://localhost:${process.env.PORT ?? 4000}/api/v1/auth/entra/callback`,
  ENTRA_ALLOWED_DOMAINS: (process.env.ENTRA_ALLOWED_DOMAINS ?? 'optsolv.com.br').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  // Contas desses domínios só entram pela Microsoft; exceção: admins de emergência listados aqui (entram com senha).
  EMERGENCY_ADMIN_EMAILS: (process.env.EMERGENCY_ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  // Endereço da interface web, para onde o login com a Microsoft volta.
  APP_URL: (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
};

if (env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) {
  throw new Error('Defina SESSION_SECRET (32+ caracteres) para rodar em produção.');
}
