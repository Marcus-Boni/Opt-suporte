# Servidor MCP

Servidor **Model Context Protocol** construído com o SDK oficial (`@modelcontextprotocol/sdk`) sobre os mesmos serviços da API, em dois transportes:

- **HTTP remoto** em `/api/v1/mcp` (Streamable HTTP, sem estado): o recomendado para agentes. Conecta com `Authorization: Bearer osk_…`, sem acesso ao banco nem ao código.
- **STDIO** (`server/src/mcp/index.ts`): para quem roda o repositório localmente, acoplado ao banco.

Nos dois, cada chamada passa pelas mesmas verificações de escopo de cliente. A tela **IA e integrações** mostra os comandos prontos com o endereço do ambiente.

## Autenticação e escopo

O servidor exige `OPTSOLV_API_TOKEN` com uma credencial criada em **Acessos e API** (o banco guarda só o hash). A credencial define o papel e o cliente de escopo; o agente só enxerga e escreve dentro dele. Ferramentas chamadas fora do escopo retornam `isError: true` com `not_found`.

## MCP remoto (HTTP)

Claude Code:

```bash
claude mcp add --transport http optsolv-suporte https://<host>/api/v1/mcp --header "Authorization: Bearer $OPTSOLV_API_TOKEN"
```

Ou no `.mcp.json` do projeto, com o token vindo do ambiente:

```json
{
  "mcpServers": {
    "optsolv-suporte": {
      "type": "http",
      "url": "https://<host>/api/v1/mcp",
      "headers": { "Authorization": "Bearer ${OPTSOLV_API_TOKEN}" }
    }
  }
}
```

- Só credenciais de API: sessão de navegador recebe 403. `GET` e `DELETE` respondem 405 (não há sessões nem stream do servidor).
- Revogar a credencial em **Acessos e API** corta o acesso na próxima chamada.
- `create_request` segue o mesmo limite da API (120 novas a cada 10 minutos por credencial). Para registro automático, use `idempotencyKey` com o id do evento de origem.

## MCP local (STDIO)

```bash
pnpm mcp
```

Com outro token:

```bash
OPTSOLV_API_TOKEN=osk_<token da credencial> pnpm mcp
```

Configuração para Claude Desktop / Claude Code (`claude_desktop_config.json` ou `.mcp.json`):

```json
{
  "mcpServers": {
    "optsolv-suporte": {
      "command": "pnpm",
      "args": ["--filter", "server", "mcp"],
      "cwd": "C:/caminho/para/opt-suporte2",
      "env": { "OPTSOLV_API_TOKEN": "osk_<token da credencial>" }
    }
  }
}
```

Cliente de exemplo em código (sobe o servidor como subprocesso, lista ferramentas, cria uma solicitação e consulta o resumo de valor):

```bash
pnpm --filter server mcp:demo
```

Saída esperada:

```
Ferramentas: list_clients, list_projects, search_requests, get_request, create_request, add_request_comment, create_delivery, link_delivery_requests, get_value_summary, create_presentation
Clientes visíveis: Cidade Engenharia
Criada: CE-18 · Criada via MCP: permitir anexar mais de uma foto po…
18 criadas, 6 concluídas, 5 entregas publicadas no período.
```

A solicitação aparece imediatamente em **Solicitações** (filtro de origem "Agente (MCP)") e no portal do cliente.

## Ferramentas

Todas têm `inputSchema` Zod e devolvem `structuredContent` (JSON) mais um resumo em texto.

| Ferramenta | Entrada | Resultado |
|---|---|---|
| `list_clients` | — | clientes acessíveis com contadores |
| `list_projects` | `clientId?` | projetos do escopo |
| `search_requests` | `clientId?`, `projectId?`, `status[]?`, `open?`, `search?`, `page?`, `pageSize?` | lista paginada |
| `get_request` | `id` | detalhe (comentários internos só para papéis internos) |
| `create_request` | `projectId`, `description`, `title?`, `category?`, `priority?`, `idempotencyKey?` | solicitação com origem `mcp` |
| `add_request_comment` | `requestId`, `body`, `visibility?` | comentário |
| `create_delivery` | `projectId`, `title`, `summary`, `details?`, `requestIds?`, `idempotencyKey?` | entrega em rascunho |
| `link_delivery_requests` | `deliveryId`, `requestIds[]` | vínculo N:N validado por cliente |
| `get_value_summary` | `clientId?`, `projectId?`, `from?`, `to?` | métricas calculadas no banco |
| `create_presentation` | `clientId`, `projectIds?`, `periodStart`, `periodEnd`, `title?` | apresentação persistida, editável na UI |

## Testes

`server/test/api-and-mcp.test.ts` conecta um cliente MCP ao servidor por transporte em memória, lista as ferramentas, cria uma solicitação pelo MCP, confirma que ela aparece na API com o cookie do cliente e verifica que o escopo bloqueia recursos de outro tenant.
