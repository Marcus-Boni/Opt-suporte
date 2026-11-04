/**
 * Exemplo de cliente MCP: sobe o servidor STDIO (src/mcp/index.ts) como subprocesso, lista as ferramentas,
 * cria uma solicitação e consulta o resumo de valor. Rode com: pnpm --filter server mcp:demo
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const token = process.env.OPTSOLV_API_TOKEN ?? 'osk_demo_agente_cidade_0000000000000000';
const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'src/mcp/index.ts'], env: { ...process.env as Record<string, string>, OPTSOLV_API_TOKEN: token }, cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const client = new Client({ name: 'optsolv-mcp-demo', version: '1.0.0' });
await client.connect(transport);

const tools = await client.listTools();
console.log('Ferramentas:', tools.tools.map((t) => t.name).join(', '));

const clients = await client.callTool({ name: 'list_clients', arguments: {} });
const list = (clients.structuredContent as { clients: { id: string; name: string }[] }).clients;
console.log('Clientes visíveis:', list.map((c) => c.name).join(', '));

const projects = await client.callTool({ name: 'list_projects', arguments: { clientId: list[0].id } });
const project = (projects.structuredContent as { projects: { id: string; name: string }[] }).projects[0];

const created = await client.callTool({ name: 'create_request', arguments: {
  projectId: project.id, category: 'melhoria', priority: 'media', idempotencyKey: `demo-${Date.now()}`,
  description: 'Criada via MCP (demonstração D6): permitir anexar mais de uma foto por visita no app de campo.',
} });
console.log(created.content?.[0] && 'text' in created.content[0] ? created.content[0].text.split('\n')[0] : created);

const summary = await client.callTool({ name: 'get_value_summary', arguments: { clientId: list[0].id } });
console.log(summary.content?.[0] && 'text' in summary.content[0] ? summary.content[0].text.split('\n')[0] : summary);

await client.close();
