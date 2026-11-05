# Especificação: widget Optsolv Suporte

Widget de suporte embutido numa solução da Optsolv. A pessoa que usa a solução abre uma solicitação sem sair da tela onde está, e ela cai direto na fila da equipe Optsolv, com o contexto técnico já preenchido.

## 1. Arquitetura (obrigatória)

```
Navegador (widget)  ──POST /api/suporte/solicitacoes──▶  Backend da solução (BFF)  ──Bearer osk_…──▶  Optsolv Suporte API
   sessão da solução,                                      valida, identifica quem                       POST /api/v1/requests
   nunca vê o token                                         reportou, limita, repassa                    POST /api/v1/requests/{id}/attachments
```

- **O token nunca vai para o navegador.** Nada de `VITE_`, `NEXT_PUBLIC_`, bundle, `localStorage` ou HTML. Quem fala com a Optsolv Suporte é o backend da solução.
- **Credencial de menor privilégio:** em Optsolv Suporte → Acessos e API → Nova credencial, papel **Usuário do cliente**, escopo no cliente desta solução, nome `Widget · <Solução>`. O token aparece uma vez; guarde no cofre de segredos do ambiente.
- **Variáveis de ambiente (só no servidor):**

| Variável | Exemplo | Obrigatória |
|---|---|---|
| `OPTSOLV_API_URL` | `https://suporte.optsolv.com.br` | sim |
| `OPTSOLV_API_TOKEN` | `osk_…` | sim |
| `OPTSOLV_PROJECT_ID` | UUID do projeto (tela IA e integrações) | sim |
| `OPTSOLV_PORTAL_URL` | `https://suporte.optsolv.com.br` | não (link "Acompanhar") |

- Sem as variáveis, o widget **não aparece** (falha fechada, com aviso no log do servidor).

## 2. Rota do backend (BFF)

`POST /api/suporte/solicitacoes` (ajuste ao padrão de rotas do projeto).

1. **Autenticação da solução obrigatória.** Sem sessão válida: 401.
2. **Quem reportou vem da sessão**, nunca do corpo da requisição: `authorLabel = nome da pessoa logada` (até 80 caracteres). A plataforma grava `Nome (via Agente: Widget · <Solução>)`.
3. **Validação na fronteira** (Zod ou equivalente):
   - `description`: texto, 5 a 4.000 caracteres (sobra espaço para o contexto técnico; o limite da API é 5.000);
   - `category`: `problema` | `duvida` | `melhoria` | `nova_funcionalidade`;
   - `urgency`: `pode_esperar` | `atrapalha` | `impede` → `priority`: `baixa` | `media` | `alta` (`critica` é decidida pela equipe na triagem);
   - `title`: opcional, até 140 caracteres;
   - `context`: objeto opcional (ver seção 4), serializado no rodapé da descrição;
   - até 3 arquivos, 5 MB cada, tipos: PNG, JPEG, GIF, WEBP, PDF, TXT, CSV, JSON, XLSX, DOCX.
4. **Limite por pessoa:** 5 envios por minuto. Acima disso: 429 com `Retry-After`.
5. **Idempotência:** o widget gera um UUID por envio (`crypto.randomUUID()`), manda no header `Idempotency-Key` e reaproveita o mesmo valor nas novas tentativas. O BFF repassa o header.
6. **Chamada à API** com tempo limite de 10 s e uma nova tentativa só para erro de rede ou 5xx (a idempotência evita duplicatas).
7. **Anexos** depois de criar a solicitação, um por vez. Falha de anexo não desfaz a solicitação: a resposta informa quais arquivos não subiram.
8. **Resposta ao widget:** `{ id, protocolo: "<clientCode>-<number>", status, portalUrl?, anexosRecusados: [] }`.
9. **Log sem conteúdo:** registre status, tempo e protocolo. Nunca o texto da solicitação, o token ou os arquivos.

## 3. Contrato da Optsolv Suporte API

Base: `${OPTSOLV_API_URL}/api/v1`. Autenticação: `Authorization: Bearer ${OPTSOLV_API_TOKEN}`. OpenAPI completo em `${OPTSOLV_API_URL}/docs`.

### Criar solicitação

```http
POST /api/v1/requests
Authorization: Bearer osk_…
Idempotency-Key: 4f0c…
Content-Type: application/json

{
  "projectId": "<OPTSOLV_PROJECT_ID>",
  "description": "Ao salvar a visita sem internet, a foto some.\n\n---\nContexto técnico\nTela: /visitas/nova\nVersão: 2.4.1\nNavegador: Chrome 131 · Windows 11\nRegistrado em: 2026-11-05T10:42:00-03:00",
  "category": "problema",
  "priority": "alta",
  "title": "Foto some ao salvar visita sem internet",
  "authorLabel": "Carla Nunes"
}
```

| Resposta | Quando | O que fazer |
|---|---|---|
| `201` | criada | mostrar o protocolo `clientCode-number` |
| `200` | mesmo `Idempotency-Key` já usado | tratar como sucesso (é a mesma solicitação) |
| `400` `validation` | dados inválidos (`error.details[]`) | mensagem no campo |
| `401` | token ausente, inválido ou revogado | esconder o widget e alertar no log |
| `404` | projeto fora do escopo da credencial | erro de configuração (`OPTSOLV_PROJECT_ID`) |
| `429` | limite da credencial (120 a cada 10 min) | respeitar `Retry-After` |
| `5xx` | falha temporária | nova tentativa com o mesmo `Idempotency-Key` |

Todos os erros seguem o envelope `{ "error": { "code", "message", "details?" } }`.

Campos úteis da resposta `201`: `id`, `clientCode`, `number`, `title`, `status` (`nova`), `source` (`api`), `authorLabel`, `createdAt`.

### Anexar arquivo

```http
POST /api/v1/requests/{id}/attachments
Authorization: Bearer osk_…
Content-Type: multipart/form-data   (campo "file")
```

`201` com `{ id, fileName, mimeType, sizeBytes }`. `413` acima de 5 MB; `400` para tipo não permitido ou conteúdo que não bate com o tipo.

### Acompanhar

Link para a pessoa: `${OPTSOLV_PORTAL_URL}/portal/solicitacoes/{id}` (exige conta no portal; sem `OPTSOLV_PORTAL_URL`, mostre só o protocolo).

## 4. Contexto técnico (transparente e mínimo)

Coletado no navegador, mostrado à pessoa antes do envio ("Ver o que será enviado") e com opção de desligar:

- rota atual **sem query string** (ex.: `/visitas/nova`);
- versão da solução (do build ou do `package.json`);
- navegador, sistema e tamanho da tela;
- data e hora com fuso;
- identificador do tenant ou da unidade, se a solução tiver.

Nunca envie: senhas, tokens, cookies, conteúdo de formulários, dados de terceiros, URL completa com parâmetros.

## 5. Interface

Siga o design system da solução (cores, fontes, raios, componentes). Na falta de um, use a referência visual da tela IA e integrações da Optsolv Suporte.

- **Inicializador:** botão flutuante no canto inferior direito, 56 px, ícone de ajuda e rótulo "Suporte" (rótulo some em telas estreitas). `aria-expanded`, `aria-controls` e foco visível.
- **Painel:** 380 px de largura, até 640 px de altura; em telas abaixo de 640 px vira folha em tela cheia. Cabeçalho com o nome da solução, "Optsolv Suporte" como selo discreto e botão fechar.
- **Formulário em uma tela:**
  1. "O que aconteceu?": quatro opções (Problema, Dúvida, Melhoria, Nova funcionalidade);
  2. descrição com placeholder que muda conforme a opção e contador de caracteres;
  3. "Quanto isso afeta seu trabalho?": Posso esperar, Atrapalha, Impede meu trabalho;
  4. anexos: arrastar, colar (Ctrl/⌘ V de captura de tela) ou escolher; miniatura e remover;
  5. "Incluir contexto técnico" ligado por padrão, com "Ver o que será enviado".
- **Envio:** botão com estado de carregamento; mensagens de erro no campo; rascunho salvo em `sessionStorage` até o envio dar certo.
- **Sucesso:** "Recebemos sua solicitação", protocolo em destaque e copiável, prazo de próxima atualização genérico ("a equipe responde por aqui e pelo portal"), "Acompanhar no portal" (se houver URL) e "Abrir outra".
- **Movimento:** abrir em 200 ms com `transform`/`opacity` (de baixo para cima, escala 0,96 → 1), sem animar layout; respeitar `prefers-reduced-motion`.
- **Acessibilidade:** `role="dialog"` com `aria-modal` e título; foco preso no painel; `Esc` fecha e devolve o foco ao inicializador; rótulos visíveis; mensagens em `aria-live="polite"`; contraste AA; navegação completa por teclado.
- **Texto:** português do Brasil, direto, sem jargão técnico.

## 6. Critérios de aceite

- [ ] Nenhum `osk_` no bundle do navegador (`grep -r "osk_" dist/` vazio) nem em logs.
- [ ] Sem sessão na solução: o widget não aparece e o BFF responde 401.
- [ ] Envio completo cria a solicitação com origem **API**, autor `Nome (via Agente: Widget · …)` e contexto no rodapé.
- [ ] Clique duplo ou nova tentativa não duplica (mesmo `Idempotency-Key`).
- [ ] 429 mostra quanto tempo esperar; falha de rede mantém o rascunho.
- [ ] Anexo acima de 5 MB ou de tipo não permitido é recusado no widget, antes do envio.
- [ ] Teclado e leitor de tela: abrir, preencher, enviar e fechar sem mouse.
- [ ] Testes automatizados do BFF: validação, autor vindo da sessão, mapeamento de urgência, repasse do `Idempotency-Key` e tratamento de 401/404/429 (API simulada).
