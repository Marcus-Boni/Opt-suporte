# Servidor MCP

`server/src/mcp/index.ts` sobe um servidor **Model Context Protocol** por STDIO, construído com o SDK oficial (`@modelcontextprotocol/sdk`) sobre os mesmos serviços da API. Não há versão HTTP exposta: o servidor roda localmente, acoplado ao banco, e cada chamada passa pelas mesmas verificações de escopo de cliente.

## Autenticação e escopo

O servidor exige `OPTSOLV_API_TOKEN` com uma credencial criada em **Acessos e API** (o banco guarda só o hash). A credencial define o papel e o cliente de escopo; o agente só enxerga e escreve dentro dele. Ferramentas chamadas fora do escopo retornam `isError: true` com `not_found`.

## Rodar

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
