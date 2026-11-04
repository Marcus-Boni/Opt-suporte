import { defineConfig } from 'vitest/config';

const base = process.env.DATABASE_URL ?? 'postgres://optsolv:optsolv@127.0.0.1:5434/optsolv_experience';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Os testes nunca tocam o banco de demonstração.
    env: { DATABASE_URL: base.replace(/\/[^/]+$/, '/optsolv_experience_test'), DATABASE_URL_BASE: base, UPLOAD_DIR: './data/uploads-test', NODE_ENV: 'test' },
  },
});
