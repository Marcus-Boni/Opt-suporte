<div align="center">

<img src="web/public/marca/logo_laranja.png" alt="Optsolv" height="44" />

# Optsolv Suporte

**A central de suporte dos clientes Optsolv: do pedido ao resultado, tudo à vista.**

Solicitações, entregas e evidências de cada cliente em um só lugar. Portal para o cliente, backoffice para a equipe,<br/>API REST e servidor MCP para agentes de IA, todos sobre a mesma camada de negócio e as mesmas regras de acesso.

![Node](https://img.shields.io/badge/Node-22%2B-3C873A?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-ready-FF6B3D)
![Tests](https://img.shields.io/badge/tests-41%20passing-2EA043)

[Visão geral](#visão-geral) · [Começando](#começando) · [Funcionalidades](#funcionalidades) · [Arquitetura](#arquitetura) · [API e MCP](#api-e-mcp) · [Design e motion](#design-e-motion) · [Testes](#testes)

</div>

<br/>

![Página de apresentação do Optsolv Suporte](docs/screenshots/landing.jpg)

> [!NOTE]
> Este repositório é um **ambiente de demonstração com dados fictícios**. "Cidade Engenharia" e "Marca Ambiental" são cenários: pessoas, pedidos, números e datas do seed não descrevem fatos reais.

## Visão geral

O Optsolv Suporte acompanha cada pedido de um cliente do começo ao fim e deixa rastro em cada etapa:

```
Solicitação  →  Triagem  →  Entrega  →  Evidência  →  Valor comunicado
(portal, WhatsApp,   (categoria,     (atende várias   (observado, esperado,   (painéis e apresentações
 API ou agente)      prioridade,     solicitações,    impacto medido          executivas geradas
                     responsável)    publicada ao     com fonte)              dos dados reais)
                                     cliente)
```

A regra central do produto: **solicitação não é entrega, e entrega não é resultado.** Nenhum número é inventado. Quando falta dado, a interface diz "não informado".

| | |
|---|---|
| ![Visão geral no tema escuro](docs/screenshots/overview-dark.jpg) | ![Solicitações no tema claro](docs/screenshots/requests-light.jpg) |
| **Visão geral** · métricas calculadas no Postgres, tema escuro | **Solicitações** · todos os canais numa fila, tema claro |

![Modo apresentação](docs/screenshots/presentation.jpg)
<p align="center"><sub>Apresentação executiva gerada a partir dos dados do período, em modo tela cheia</sub></p>

## Começando

### Pré-requisitos

- **Node.js 22+** (validado com 24.11)
- **pnpm** via Corepack: `corepack enable`
- **Docker** com Compose, para o Postgres 17 local (ou qualquer Postgres 15+)

Nenhuma credencial externa é necessária.

### Instalação

```bash
pnpm install
```
```bash
cp .env.example server/.env
```

Preencha a `DATABASE_URL` do Azure e o `SESSION_SECRET` em `server/.env`. Depois:

```bash
pnpm db:migrate
```
```bash
pnpm --filter server db:create-admin --email pessoa@optsolv.com.br --name "Nome Sobrenome"
```
```bash
pnpm dev
```

<details>
<summary><b>Ambiente local de demonstração</b> (Docker, dados fictícios)</summary>

Use a `DATABASE_URL` local comentada no `.env.example` e rode:

```bash
pnpm db:up
```
```bash
pnpm db:migrate && pnpm db:seed
```

</details>

| Endereço | O que é |
|---|---|
| http://localhost:5173 | Página de apresentação; login em `/entrar`, backoffice em `/app`, portal do cliente em `/portal` |
| http://localhost:4000/docs | Swagger UI da API v1 |
| http://localhost:4000/openapi.json | Especificação OpenAPI 3.1 |

> [!IMPORTANT]
> No banco real, seed, reset e testes **recusam bancos remotos** por segurança. Guia completo em [`docs/DATABASE.md`](docs/DATABASE.md).

### Contas de demonstração (só no ambiente local)

Todas com a senha `optsolv2026`.

| E-mail | Pessoa fictícia | Papel | Enxerga |
|---|---|---|---|
| `admin@optsolv.demo` | Helena Prado | Administradora Optsolv | Todos os clientes, Acessos e API |
| `ana@optsolv.demo` | Ana Ribeiro | Colaboradora Optsolv | Cidade Engenharia e Marca Ambiental |
| `bruno@optsolv.demo` | Bruno Saraiva | Colaborador Optsolv | Somente Marca Ambiental |
| `joao@cidadeengenharia.demo` | João Pereira | Cliente | Portal da Cidade Engenharia |
| `marina@cidadeengenharia.demo` | Marina Lobo | Cliente | Portal da Cidade Engenharia |
| `otavio@marcaambiental.demo` | Otávio Reis | Cliente | Portal da Marca Ambiental |

Tokens de API/MCP criados pelo seed (o banco guarda só o hash):

| Token | Papel | Escopo |
|---|---|---|
| `osk_demo_agente_cidade_0000000000000000` | colaborador | Cidade Engenharia |
| `osk_demo_admin_total_000000000000000000` | admin | todos os clientes |

### Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | API (4000) e web (5173) em paralelo, com reload |
| `pnpm db:up` / `pnpm db:down` | Sobe/derruba o Postgres do `docker-compose.yml` (porta 5434) |
| `pnpm db:migrate` | Aplica as migrações Drizzle (`server/drizzle`) |
| `pnpm db:seed` | Seed fictício e idempotente (só banco local) |
| `pnpm --filter server db:create-admin` | Cria o primeiro administrador num banco novo |
| `pnpm db:reset` | Limpa o banco (anexos inclusos), migra e semeia de novo (só banco local) |
| `pnpm test` | Suíte Vitest em banco isolado |
| `pnpm typecheck` | Checagem de tipos nos dois pacotes |
| `pnpm build` | Build de produção do web |
| `pnpm mcp` | Servidor MCP via STDIO (lê `OPTSOLV_API_TOKEN`) |
| `pnpm --filter server ai:eval` | Avalia a IA da captura contra o conjunto rotulado (chama o Foundry) |
| `pnpm --filter server mcp:demo` | Cliente MCP de exemplo: lista ferramentas, cria solicitação e consulta valor |

## Funcionalidades

### Para o cliente (portal)
- Abre solicitações em segundos, com anexos (até 5 MB, tipos controlados).
- Acompanha cada etapa em linguagem clara ("Aguardando você" quando a equipe precisa de resposta).
- Recebe as novidades de cada entrega publicada e vê os resultados apresentados.
- Nunca vê notas internas nem dados de outro cliente.

### Para a equipe Optsolv (backoffice)
- **Solicitações** de todos os canais numa fila só, com status, prioridade, categoria, responsável, comentários públicos e internos, reabertura com motivo e histórico por evento.
- **Captura de WhatsApp com IA (Microsoft Foundry):** a equipe cola a conversa; a IA separa pedidos de conversa social e sugere título, categoria e prioridade; repetidas são apontadas e nada é gravado sem revisão humana. Sem IA disponível, regras locais assumem. Ver [`docs/AI.md`](docs/AI.md).
- **Entregas e evidências:** uma entrega atende várias solicitações; evidências separadas em benefício observado, esperado e impacto medido (valor, unidade e fonte obrigatórios).
- **Painéis:** abertas, concluídas, sem responsável, aguardando cliente, mediana de dias até concluir, série mensal e distribuição por origem e categoria.
- **Apresentações executivas:** geradas por cliente, projetos e período; narrativa editável, modo tela cheia, exportação em PDF e compartilhamento com o portal.
- **Acessos e API:** usuários, credenciais por cliente e trilha de auditoria.

### Experiência
- Tema claro, escuro e "seguir o sistema", com transição em chevron (View Transitions).
- Sidebar recolhível (`Ctrl/⌘ B`), paleta de comandos (`Ctrl/⌘ K`), dicas de contexto e toasts nas ações relevantes.
- Esqueletos com o formato de cada tela, barra de progresso de rota, telas de 404 e erro com a marca.
- Página de apresentação pública com motion em GSAP e anime.js.

## Arquitetura

Monólito modular em dois pacotes (pnpm workspaces). A interface, a API REST e o servidor MCP usam **os mesmos serviços**, então as regras de negócio e de permissão existem em um lugar só.

```mermaid
flowchart LR
  subgraph Clientes
    W["Web<br/>React 19 + Vite"]
    A["Integrações<br/>REST + Bearer"]
    M["Agentes de IA<br/>MCP (STDIO)"]
  end
  subgraph server["server (Fastify 5)"]
    R["Rotas /api/v1<br/>schemas Zod → OpenAPI"]
    MCP["Ferramentas MCP"]
    S["Serviços<br/>assertClient · auditoria"]
  end
  DB[("PostgreSQL 17<br/>Drizzle ORM")]
  W -- cookie de sessão --> R
  A -- "Bearer osk_…" --> R
  M --> MCP
  R --> S
  MCP --> S
  S --> DB
```

### Stack

| Camada | Tecnologias |
|---|---|
| **Servidor** | Fastify 5, Drizzle ORM, Zod 4 (`fastify-type-provider-zod` gera o OpenAPI), MCP SDK, scrypt |
| **Banco** | PostgreSQL 17: Docker Compose local, Azure Database for PostgreSQL em produção; TLS verificado, migrações SQL versionadas, anexos em `bytea` |
| **Web** | React 19, Vite 7, React Router 7, TanStack Query 5, Tailwind CSS 4, shadcn/ui (Radix) |
| **Interface** | Recharts, cmdk, Sonner, react-day-picker, Lucide |
| **IA** | Microsoft Foundry (Azure OpenAI, Responses API v1, saída em JSON Schema estrito), SDK `openai` + `@azure/identity` (Entra ID, sem chaves) |
| **Motion** | GSAP (SplitText, ScrollTrigger), anime.js 4, Lenis, View Transitions API |
| **Qualidade** | TypeScript estrito, Vitest com banco isolado |

### Decisões que importam

- **Permissão no serviço, não na rota.** Todo serviço recebe um `Actor` já resolvido (sessão ou credencial) e chama `assertClient` antes de ler ou escrever. Nenhum `clientId` enviado pelo navegador é tratado como prova de acesso; recurso de outro cliente responde **404**, sem revelar que existe.
- **Conteúdo interno filtrado na consulta.** Comentários e eventos internos saem do banco já filtrados por `visibility`/`isPublic`; não são apenas escondidos na tela.
- **Sessão em cookie assinado e credenciais Bearer** em vez de JWT: revogação imediata e nenhuma dependência extra.
- **Exportação em PDF pela impressão do navegador:** a rota `/imprimir` gera um slide por página A4 paisagem.
- **IA com plano B:** a captura chama o modelo do Foundry direto (sem agente: é uma extração de uma etapa), com Entra ID, dados pessoais mascarados e saída validada; qualquer falha cai para as regras locais e o modo usado fica registrado.

### Estrutura do repositório

```
.
├── server/
│   ├── src/
│   │   ├── app.ts          Fastify, OpenAPI, autenticação, erros
│   │   ├── auth/           ator, senhas, sessões, credenciais
│   │   ├── services/       clientes, solicitações, entregas, métricas, apresentações, captura, acessos
│   │   ├── routes/         rotas v1 com schemas Zod
│   │   ├── mcp/            servidor MCP sobre os serviços
│   │   └── db/             schema, migrações, seed, reset
│   ├── drizzle/            migrações SQL
│   ├── test/               Vitest (banco isolado)
│   └── scripts/            cliente MCP de exemplo
├── web/
│   └── src/
│       ├── pages/landing/  página de apresentação (GSAP + anime.js)
│       ├── pages/app/      backoffice da equipe
│       ├── pages/portal/   portal do cliente
│       ├── pages/shared/   modo apresentação e impressão
│       ├── components/     design system (ui/), slides, gráficos, esqueletos, telas de status
│       └── lib/            API, autenticação, tema, toasts
├── docs/                   API.md, MCP.md, DATABASE.md, AI.md, TESTES.md, screenshots/, evidencias/
└── assets/marca_oficial/   fonte da verdade dos logotipos
```

## API e MCP

Documentação completa em [`docs/API.md`](docs/API.md), [`docs/MCP.md`](docs/MCP.md) e [`docs/DATABASE.md`](docs/DATABASE.md).

- **API REST v1:** 40 rotas em `/api/v1`, OpenAPI em `/docs`, sessão por cookie **ou** `Authorization: Bearer osk_…`, envelope de erro uniforme, `Idempotency-Key` nas criações, paginação e filtros.
- **MCP:** servidor STDIO com 10 ferramentas concretas (schemas Zod), autenticado por credencial e limitado ao escopo dela.

```bash
curl -H "Authorization: Bearer osk_demo_agente_cidade_0000000000000000" http://localhost:4000/api/v1/projects
```
```bash
curl -X POST http://localhost:4000/api/v1/requests -H "Authorization: Bearer osk_demo_agente_cidade_0000000000000000" -H "Content-Type: application/json" -H "Idempotency-Key: demo-123" -d "{\"projectId\":\"<id de um projeto da Cidade>\",\"description\":\"Incluir legenda de cores no mapa de obras.\",\"category\":\"melhoria\"}"
```

A solicitação criada aparece no backoffice com a origem **API** (ou **Agente MCP**, se criada pelo `pnpm --filter server mcp:demo`).

## Design e motion

- **Tipografia única:** Geist e Geist Mono (mono só para identificadores literais, como códigos e tokens). Escala de texto, raios e espaçamento definidos como tokens em `web/src/styles.css`.
- **Cor:** o laranja de interface `#FF6B3D` marca acentos sem texto. Preenchimentos com texto usam `#D14318` com texto branco (contraste AA de 4,6:1). Os logotipos oficiais nunca são recoloridos.
- **Temas:** paleta em variáveis que alternam entre claro e escuro; slides e impressão ficam sempre no claro.
- **Regras de motion:**
  - Curvas fortes e durações curtas (pressão 140 ms, popover 160 ms, modal 220 ms).
  - Entrada com *ease-out*, nada surge de `scale(0)`, ações por teclado não animam.
  - Animação usa só `transform` e `opacity`.
  - `prefers-reduced-motion` respeitado em toda a aplicação.

## Testes

```bash
pnpm test
```

41 testes (Vitest) rodam em um banco separado (`optsolv_experience_test`), recriado, migrado e semeado a cada execução. A suíte cobre:
- isolamento entre clientes na API, no MCP e no download de anexos;
- criação via API e MCP, com idempotência;
- upload com limites de tamanho e tipo;
- concorrência e heurísticas da captura de WhatsApp;
- anexos no banco (bytes íntegros, ETag/304, assinatura de arquivo) e travas contra banco remoto;
- IA da captura com modelo simulado: validação da saída, filtro de conteúdo, mascaramento de dados pessoais e fallback.

As jornadas de interface (D1 a D7) estão documentadas com capturas em [`docs/TESTES.md`](docs/TESTES.md).

## Limitações conhecidas

- Sem integração direta com o WhatsApp: a entrada é por colagem e revisão humana; a IA sugere, não grava.
- PDF gerado pelo diálogo de impressão do navegador, não no servidor.
- Permissões por cliente; colaboradores veem todos os projetos dos clientes vinculados.
- Sem notificações por e-mail, SLA, registro de horas ou redefinição de senha.
- Anexos guardados no próprio Postgres (até 5 MB, com verificação de assinatura), sem antivírus nem CDN; o caminho natural de crescimento é o Azure Blob Storage.
- Apresentações são instantâneos do período; dados novos pedem nova geração (o editor avisa).
- Limite de tentativas de login em memória. Em produção, o servidor recusa subir sem `SESSION_SECRET` e o seed recusa rodar.

---

<div align="center">
<img src="web/public/marca/simbolo_laranja.png" alt="" height="22" /><br/>
<sub>© 2026 Optsolv · Todos os direitos reservados</sub>
</div>
