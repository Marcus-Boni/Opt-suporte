import { defineConfig } from 'vitest/config';

// Base dos testes: TEST_DATABASE_URL, nunca a DATABASE_URL da aplicação (que pode apontar para o Azure).
const base = process.env.TEST_DATABASE_URL ?? 'postgres://optsolv:optsolv@127.0.0.1:5434/optsolv_experience';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Os testes nunca tocam o banco de demonstração: usam um banco irmão "<base>_test", recriado a cada execução.
    env: { DATABASE_URL: base.replace(/\/[^/?]+(\?|$)/, '/optsolv_experience_test$1'), DATABASE_URL_BASE: base, NODE_ENV: 'test',
      // IA desligada por padrão nos testes (nunca chama o Foundry); os testes de IA ligam com um modelo simulado.
      AZURE_OPENAI_ENDPOINT: '' },
  },
});
