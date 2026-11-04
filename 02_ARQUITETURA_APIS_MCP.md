# 02 — ARQUITETURA, API E MCP (SEM ENGESSAR A IMPLEMENTAÇÃO)

## Princípios

**Protótipo real e reproduzível**, mas sem arquitetura excessiva. A implementação pode ser um monólito modular, com serviços internos organizados por domínio: `identidade/tenancy`, `clientes-projetos`, `solicitacoes`, `entregas-evidencias`, `valor-apresentacoes`, `integracoes-agentes`.

**Stack preferencial:** React + TypeScript + Tailwind no frontend; backend TypeScript (ex.: Fastify); PostgreSQL; ORM com migrações; Zod/validação tipada; OpenAPI; SDK oficial do MCP; testes Vitest/Playwright. O agente pode escolher Vite, TanStack Router/Start, bibliotecas visuais e organização de pacotes conforme critério técnico e documentar a decisão. Astro não é obrigatório: pode ser útil em páginas públicas, mas não é requisito para o painel autenticado.

**A aplicação deve rodar localmente** com comandos claros, migração e seed, sem depender de chaves externas. O banco armazena dados; não usar somente `localStorage` como fonte de verdade.

## Referências preferenciais de componentes, visualização e movimento

**Diretriz para o Fable 5.1:** antes de desenvolver componentes visuais do zero ou recorrer a outras bibliotecas, explorar **preferencialmente** as referências abaixo. Elas orientam a seleção e adaptação de componentes, não são uma lista de dependências obrigatórias. O agente tem **liberdade criativa ampla** para combinar, modificar, reconstruir ou substituir soluções quando isso melhorar a qualidade, acessibilidade, consistência ou desempenho do produto.

| Referência oficial | Papel preferencial na plataforma |
|---|---|
| [shadcn/ui](https://ui.shadcn.com/) | **Base principal de componentes de interface**: botões, formulários, diálogos, tabelas, menus, navegação, seletores e estados interativos. Personalizar profundamente, sem parecer uma instalação padrão. |
| [Kokonut UI](https://kokonutui.com/) | Cards, comandos, elementos interativos e microinterações refinadas; adaptar as melhores ideias a fluxos reais. |
| [React Bits](https://www.reactbits.dev/) | Detalhes expressivos, transições, backgrounds e efeitos pontuais que elevem a percepção de qualidade. |
| [Bklit](https://bklit.com/) | **Primeira referência para visualização de dados**: gráficos dos dashboards, indicadores, comparações de entregas e apresentações de valor. |
| [GSAP](https://gsap.com/) | Animações complexas, transições coreografadas, narrativas visuais e experiências de apresentação executiva. |
| [Anime.js](https://animejs.com/documentation/) | Alternativa para animações específicas, timelines, SVGs e interações personalizadas quando tecnicamente conveniente. |
| [Lenis](https://lenis.dev/) | Rolagem suave **somente onde agrega valor**, como experiências imersivas e apresentação de resultados; não aplicar indiscriminadamente aos painéis operacionais. |

### Critérios de composição

- **Preferir aproveitar e adaptar componentes bem implementados** das referências, em vez de recriar elementos básicos sem necessidade. A experiência final deve ter **identidade própria da Optsolv**, e não parecer uma colagem de demonstrações.
- Usar **shadcn/ui como ponto de partida**, mas permitir outras escolhas justificadas. Para gráficos, examinar primeiro Bklit; para componentes criativos, Kokonut UI e React Bits. GSAP, Anime.js e Lenis são **ferramentas de movimento/rolagem**, não substitutos de uma biblioteca de componentes.
- **Não instalar todas as bibliotecas automaticamente**. Escolher as que forem efetivamente necessárias, evitando mecanismos concorrentes para a mesma animação e custos de bundle sem benefício.
- Dar prioridade a **responsividade, usabilidade, contraste, navegação por teclado, acessibilidade, estados de erro/carregamento/vazio e `prefers-reduced-motion`**. Animações devem servir à compreensão da interface e nunca atrasar tarefas frequentes.
- Considerar licenças, manutenção, compatibilidade React/TypeScript, desempenho e permissões de uso antes de incorporar código ou recursos de terceiros.
- **Direção de marca:** explorar um **laranja de interface levemente mais claro e acolhedor** que o laranja principal da Optsolv, sem fixar um tom obrigatório; **logotipos e símbolos devem utilizar exclusivamente os arquivos oficiais fornecidos, sem recoloração, distorção ou recriação**.
- Exercitar a criatividade especialmente no **dashboard multicliente**, na **triagem de solicitações**, nos **detalhes de entregas e evidências** e na **geração/visualização de apresentações de valor**. Cada efeito deve reforçar clareza e confiança.

> Resultado esperado: um produto visualmente sofisticado, coerente e autoral, com os melhores componentes dessas fontes **como preferência de pesquisa e implementação**, mas sem limitar o julgamento técnico e criativo do agente.

## Modelo lógico mínimo

- `Tenant/Client` — organização cliente, políticas de acesso.
- `Project` — pertencente a um tenant.
- `User`, `Membership` — papéis e associações aos clientes/projetos.
- `Request` — solicitação, origem, categoria, prioridade, status, responsável, autor e timestamps.
- `RequestComment`, `Attachment`, `RequestEvent` — conversa, anexos e auditoria.
- `SourceMessage` — texto/origem inserido por captura assistida, ligado às solicitações criadas.
- `Delivery` — entrega registrada, status de publicação e descrição não técnica.
- `DeliveryRequest` — relação N:N entre entregas e solicitações.
- `ValueEvidence` — evidência/benefício, tipo (`observado`, `esperado`, `medido`), fonte e eventual unidade.
- `Presentation`, `PresentationItem` — configuração, slides/narrativa editável, escopo e versão compartilhada.
- `ApiCredential` e `AuditLog` — autorização de agentes e rastreabilidade.

Tenancy não é apenas filtro visual: toda consulta e mutação deve derivar o tenant autorizado da identidade autenticada. **Nunca confiar no `tenantId` enviado pelo navegador como prova de permissão.** Arquivos também exigem autorização antes do download.

## API REST mínima (v1)

A forma exata dos recursos e schemas fica a cargo do agente, mas documentar em `/openapi.json` ou `/docs` e oferecer ao menos:

| Método | Recurso | Objetivo |
|---|---|---|
| GET, POST | `/api/v1/clients` | Consultar/criar clientes (interno). |
| GET, POST | `/api/v1/projects` | Consultar/criar projetos. |
| GET, POST | `/api/v1/requests` | Listar/filtrar/criar solicitações. |
| GET, PATCH | `/api/v1/requests/:id` | Detalhar/alterar demanda. |
| POST | `/api/v1/requests/:id/comments` | Comentário público ou interno conforme papel. |
| POST | `/api/v1/requests/:id/attachments` | Enviar anexo com validação. |
| POST | `/api/v1/intake/whatsapp-preview` | Pré-visualizar sugestões, sem gravá-las. |
| GET, POST | `/api/v1/deliveries` | Listar/criar entregas. |
| GET, PATCH | `/api/v1/deliveries/:id` | Editar/publicar conforme permissões. |
| POST | `/api/v1/deliveries/:id/requests` | Relacionar entrega a demandas. |
| GET | `/api/v1/metrics` | Indicadores com filtros e escopo. |
| GET, POST | `/api/v1/presentations` | Listar/gerar apresentações. |
| GET, PATCH | `/api/v1/presentations/:id` | Visualizar/editar slides. |

Endpoints adicionais são bem-vindos quando necessários. Paginação e filtros de tenant/projeto/status/período são essenciais para listas. Utilizar payloads e erros consistentes, validação de entrada, autorização por operação, limites de upload, HTTPS quando remoto, tratamento de erros e logs sem dados sensíveis.

**Exemplo apenas ilustrativo de payload de criação:**

```json
{
  "projectId": "project-demo-cidade",
  "title": "Melhorar a pesquisa de visitas",
  "description": "A listagem não facilita localizar os registros mais recentes.",
  "category": "melhoria",
  "source": "api"
}
```

O tenant é resolvido e validado a partir da identidade/associação do projeto. Em operações de escrita via agentes, aceitar `Idempotency-Key` para evitar criação duplicada por repetição de chamadas.

## MCP funcional para agentes

Oferecer um **servidor MCP local (STDIO)** conectado aos mesmos serviços de negócio da API. A versão HTTP remota é opcional e só deve ser exposta se tiver autenticação e autorização apropriadas; **não usar endpoint MCP público sem proteção**.

Ferramentas mínimas sugeridas:

| Ferramenta | Resultado |
|---|---|
| `list_clients` | Clientes permitidos para a identidade do agente. |
| `list_projects` | Projetos de um cliente autorizado. |
| `search_requests` | Pesquisa/filtragem de solicitações. |
| `get_request` | Detalhe de uma solicitação autorizada. |
| `create_request` | Criação validada e idempotente. |
| `add_request_comment` | Comentário com controle de visibilidade. |
| `create_delivery` | Registro de entrega em projeto autorizado. |
| `link_delivery_requests` | Vínculo N:N com validação de tenant. |
| `get_value_summary` | Resumo verificável por cliente/período. |
| `create_presentation` | Geração de apresentação persistida a partir dos dados autorizados. |

Cada ferramenta precisa de schema de entrada/saída, retorno de erro claro e teste de autorização. O servidor MCP não deve ser uma simulação textual: um `create_request` executado por agente precisa aparecer na aplicação web imediatamente após atualizar a tela.

## Identidade, segurança e permissões

- Login de demonstração funcional com sessões reais no backend e contas seed para administrador, equipe interna e dois usuários externos; sem depender de SSO externo.
- Papéis: `admin_optsolv`, `colaborador_optsolv`, `cliente`. Internos podem ser limitados a clientes/projetos autorizados.
- Sempre verificar vínculo do usuário com tenant e projeto em leituras **e** escritas; aplicar limites equivalentes em API, MCP, download e relatórios.
- Comentários `internal` não podem aparecer para clientes. Auditoria de criação, alterações relevantes e publicação de entregas.
- Dados reais de clientes, WhatsApp e fotos não serão usados sem permissão; o protótipo trabalha com seed fictício.
- Segredos em variáveis de ambiente, `.env.example` sem tokens reais; não publicar credenciais no frontend.

## IA e captação, sem dependências externas obrigatórias

A IA pode sugerir título, categoria, descrição, prioridade e similaridade de solicitações. Para funcionamento local, fornecer um **modo demonstração determinístico**, claramente identificado e com revisão humana. Um provedor real por chave pode ser opcional; não alegar uso de IA real quando for heurístico. Colagem de mensagens não equivale a integração oficial com WhatsApp.

**Não existe integração Azure DevOps neste escopo.** O vínculo principal é entre solicitações, entregas e evidências internas.

## Qualidade técnica esperada

Migrações, seeds, contratos tipados, testes para isolamento multi-tenant, testes das APIs e das ferramentas MCP, estados de erro/empty/loading e ao menos os três fluxos E2E descritos no documento de produto. Entregar README com instruções exatas, URL local, contas demo, portas, scripts e modo de execução. Não exigir Docker se houver alternativa reprodutível claramente documentada, mas fornecer caminho simples.
