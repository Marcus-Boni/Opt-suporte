# API REST v1

Base: `http://localhost:4000/api/v1`. Documentação interativa em `http://localhost:4000/docs` e especificação em `/openapi.json` (OpenAPI 3.1, gerada dos mesmos schemas Zod que validam as rotas).

## Autenticação

Duas formas, verificadas em todas as rotas exceto `POST /auth/login`:

| Forma | Como | Para quem |
|---|---|---|
| Sessão | `POST /auth/login` (clientes) ou `GET /auth/entra/login` (equipe, Microsoft Entra ID; ver [ENTRA.md](ENTRA.md)) gravam o cookie assinado `osx_session` (httpOnly, 7 dias) | Interface web |
| Credencial | `Authorization: Bearer osk_…` | Agentes, integrações, MCP |

A identidade resolve um **ator** com papel (`admin_optsolv`, `colaborador_optsolv`, `cliente`) e a lista de clientes visíveis. Nenhum `clientId` enviado pelo chamador amplia esse escopo: ele só filtra. Recurso fora do escopo responde **404** `not_found`, sem revelar se existe.

```bash
curl -c cookies.txt -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"<seu e-mail>\",\"password\":\"<sua senha>\"}"
```
```bash
curl -H "Authorization: Bearer $OPTSOLV_API_TOKEN" http://localhost:4000/api/v1/auth/me
```

## Erros

Sempre `{ "error": { "code", "message", "details?" } }`. Códigos: `validation` (400), `bad_request` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404), `file_too_large` (413), `too_many_requests` / `too_many_attempts` (429, com header `Retry-After`), `internal` (500).

## Rotas

| Método | Rota | Papel | Observações |
|---|---|---|---|
| POST | `/auth/login` | público | e-mail + senha |
| POST | `/auth/logout` | todos | encerra a sessão |
| GET | `/auth/me` | todos | ator, perfil e clientes visíveis |
| GET | `/clients` | todos | clientes do escopo, com contadores |
| POST | `/clients` | admin | `name`, `shortCode?`, `segment?`, `description?` |
| GET | `/clients/{id}` | todos | projetos e usuários do cliente |
| GET | `/projects?clientId=` | todos | |
| POST | `/projects` | interno | `clientId`, `name`, `code?` |
| GET | `/team` | interno | equipe para atribuição |
| GET | `/requests` | todos | filtros: `clientId`, `projectId`, `status` (vírgula), `category`, `priority`, `source`, `assigneeUserId`, `unassigned`, `open`, `search`, `from`, `to`, `page`, `pageSize` |
| POST | `/requests` | todos | `projectId`, `description`, `title?`, `category?`, `priority?`, `authorLabel?`; header `Idempotency-Key` opcional; origem inferida (`portal`, `admin`, `api`). `authorLabel`: a equipe informa o remetente; uma credencial de cliente (widget) informa quem reportou, gravado como `Nome (via Agente: credencial)`; no portal é ignorado. Limite: 120 novas a cada 10 min por identidade |
| GET | `/requests/{id}` | todos | cliente recebe só comentários públicos, eventos públicos e entregas publicadas |
| PATCH | `/requests/{id}` | todos | interno: `status`, `assigneeUserId`, `category`, `priority`, `title`, `description`, `note`; cliente: apenas reabrir (`status: "nova"` + `reason`) |
| POST | `/requests/{id}/comments` | todos | `body`, `visibility` (`internal` só para internos; cliente é forçado a `public`) |
| DELETE | `/requests/{id}/comments/{commentId}` | autor | desfaz um comentário próprio nos primeiros 10 minutos (204; 403 para outro autor ou fora da janela) |
| POST | `/requests/{id}/attachments` | todos | multipart campo `file`, ≤ 5 MB; imagens, PDF, texto, CSV, XLSX, DOCX |
| GET | `/attachments/{id}` | todos | download autorizado pelo escopo; anexo de entrega em rascunho é invisível ao cliente |
| POST | `/intake/whatsapp-preview` | interno | `clientId`, `projectId?`, `text` → sugestões (não grava). Usa IA do Foundry quando configurada; `mode` (`heuristica` ou `ia:<implantação>`) e `ai` informam quem analisou. Ver [AI.md](AI.md) |
| POST | `/intake/whatsapp-commit` | interno | `clientId`, `projectId`, `rawText`, `items[]` → solicitações com origem `captura_whatsapp` |
| GET | `/deliveries` | todos | cliente vê só `publicada`; filtros `clientId`, `projectId`, `status`, `from`, `to`, paginação |
| POST | `/deliveries` | interno | `projectId`, `title`, `summary`, `details?`, `deliveredAt?`, `requestIds?`; `Idempotency-Key` |
| GET | `/deliveries/{id}` | todos | solicitações vinculadas, evidências, anexos |
| PATCH | `/deliveries/{id}` | interno | edição e publicação (`status: "publicada"`) |
| POST | `/deliveries/{id}/requests` | interno | `requestIds[]` do mesmo cliente |
| DELETE | `/deliveries/{id}/requests/{requestId}` | interno | |
| POST | `/deliveries/{id}/evidences` | interno | `kind` (`observado`/`esperado`/`medido`), `title`, `description?`, `metricValue?` (obrigatório em `medido`), `metricUnit?`, `sourceLabel?`, `linkUrl?`, `attachmentId?` |
| POST | `/deliveries/{id}/attachments` | interno | arquivo de evidência |
| GET | `/metrics` | todos | `clientId?`, `projectId?`, `from?`, `to?` (padrão 180 dias) |
| GET | `/presentations` | todos | cliente vê só `compartilhada` |
| POST | `/presentations` | interno | `clientId`, `projectIds?`, `periodStart`, `periodEnd`, `title?` → slides persistidos |
| GET | `/presentations/{id}` | todos | |
| PATCH | `/presentations/{id}` | interno | `title?`, `status?`, `slides[]` (`id`, `title?`, `body?`) |
| DELETE | `/presentations/{id}` | interno | |
| GET/POST | `/users`, PATCH `/users/{id}` | admin | criação e ativação |
| GET/POST | `/credentials`, DELETE `/credentials/{id}` | admin | token exibido só na criação |
| GET | `/audit?limit=` | admin | trilha de auditoria |

## Widget nas soluções

O widget de suporte dentro das soluções Optsolv usa esta API pelo backend da própria solução (o token nunca vai ao navegador), com uma credencial de papel **Usuário do cliente**. Contrato completo, interface e critérios de aceite em [`web/public/integracoes/skills/optsolv-suporte-widget/especificacao.md`](../web/public/integracoes/skills/optsolv-suporte-widget/especificacao.md), também publicado pela própria plataforma em `/integracoes/skills/optsolv-suporte-widget/` (prompt padrão e skill na tela **IA e integrações**).

## Exemplos

Criar solicitação com credencial (idempotente):

```bash
curl -X POST http://localhost:4000/api/v1/requests -H "Authorization: Bearer $OPTSOLV_API_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: pedido-42" -d "{\"projectId\":\"<projectId>\",\"description\":\"Permitir exportar a agenda em PDF.\",\"category\":\"melhoria\",\"priority\":\"media\"}"
```

Repetir a mesma chamada com a mesma chave devolve `200` e o mesmo registro. Listar só o que veio de agentes:

```bash
curl -b cookies.txt "http://localhost:4000/api/v1/requests?source=mcp"
```

Pré-visualizar captura (o arquivo `docs/exemplos/whatsapp-exemplo.json` tem um corpo pronto):

```bash
curl -b cookies.txt -X POST http://localhost:4000/api/v1/intake/whatsapp-preview -H "Content-Type: application/json" --data-binary @docs/exemplos/whatsapp-exemplo.json
```

Métricas de um cliente no período:

```bash
curl -b cookies.txt "http://localhost:4000/api/v1/metrics?clientId=<clientId>&from=2026-05-01&to=2026-10-31"
```
