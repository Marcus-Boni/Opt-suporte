import { buildApp } from './app.js';
import { env } from './env.js';
import { pool } from './db/index.js';
import { describeDatabase } from './db/connection.js';

const app = await buildApp();
await app.listen({ port: env.PORT, host: '0.0.0.0' });
app.log.info(`API em http://localhost:${env.PORT} · docs em http://localhost:${env.PORT}/docs · banco ${describeDatabase(env.DATABASE_URL)}`);

// Encerramento limpo (deploy, escala, Ctrl+C): para de aceitar requisições, termina as em curso e fecha o pool.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    app.log.info(`${signal} recebido: encerrando.`);
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
