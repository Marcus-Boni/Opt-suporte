import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { actorFromToken } from '../auth/service.js';
import { createMcpServer } from './server.js';

const token = process.env.OPTSOLV_API_TOKEN;
if (!token) {
  console.error('Defina OPTSOLV_API_TOKEN com uma credencial criada em Acessos (ex.: a do seed).');
  process.exit(1);
}
const actor = await actorFromToken(token);
if (!actor) {
  console.error('Credencial inválida ou revogada.');
  process.exit(1);
}
const server = createMcpServer(actor);
await server.connect(new StdioServerTransport());
console.error(`MCP Optsolv Suporte pronto como "${actor.label}" (${actor.role}, escopo: ${actor.clientIds === 'all' ? 'todos os clientes' : `${actor.clientIds.length} cliente(s)`}).`);
