import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../mcp/server.js';
import { HttpError } from '../lib/errors.js';

/**
 * MCP remoto (Streamable HTTP, sem estado) em /api/v1/mcp: agentes conectam com
 * `Authorization: Bearer osk_…`, sem acesso ao banco nem ao código. Cada POST monta servidor e transporte
 * com o ator da credencial; as ferramentas são as mesmas do STDIO e passam pelas mesmas regras de escopo.
 */
export const mcpRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/mcp', { schema: { hide: true } }, async (request, reply) => {
    // Sessão de navegador fica de fora: o MCP é para agentes e integrações, identificados por credencial revogável.
    if (request.actor.kind !== 'credential') throw new HttpError(403, 'forbidden', 'O MCP aceita só credenciais de API (Authorization: Bearer osk_…).');
    const server = createMcpServer(request.actor);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    reply.hijack();
    reply.raw.on('close', () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (err) {
      request.log.error(err);
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Erro interno.' }, id: null }));
      }
    }
  });

  // Sem sessões: não há stream GET nem encerramento de sessão (DELETE).
  const notAllowed = async (_r: unknown, reply: FastifyReply) => reply.status(405).header('allow', 'POST').send({ jsonrpc: '2.0', error: { code: -32000, message: 'Método não permitido: use POST.' }, id: null });
  app.get('/mcp', { schema: { hide: true } }, notAllowed);
  app.delete('/mcp', { schema: { hide: true } }, notAllowed);
};
