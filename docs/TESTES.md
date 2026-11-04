# Testes e evidências

## Suíte automatizada (Vitest)

```bash
pnpm test
```

Roda em `optsolv_experience_test`, um banco criado automaticamente ao lado do banco de demonstração e **recriado, migrado e semeado a cada execução** (`server/test/global-setup.ts`). Anexos de teste vão para `server/data/uploads-test`.

Última execução (03/11/2026): **2 arquivos, 27 testes, todos aprovados**.

| Arquivo | Caso | Demonstra |
|---|---|---|
| `tenancy.test.ts` | cliente só lista solicitações do próprio tenant | D3 |
| | cliente da Cidade não acessa solicitação da Marca por ID (404) | D7 |
| | filtro por `clientId` alheio, entregas/apresentações/anexos de outro tenant bloqueados | D3, D7 |
| | comentários internos nunca chegam ao cliente; equipe os vê | D3 |
| | cliente que pede comentário interno recebe público | D3 |
| | credencial com escopo Cidade não cria em projeto da Marca | D6, D7 |
| | entrega não vincula solicitação de outro cliente | D2, D7 |
| | contadores por cliente calculados no banco | dashboards |
| | sem autenticação: 401 | segurança |
| | apresentação nunca referencia solicitações de outro cliente | D5, D7 |
| | login bloqueado após 10 erros (429); `nosniff` em toda resposta | segurança |
| `api-and-mcp.test.ts` | criação via credencial, idempotente, visível ao cliente | D6 |
| | cliente cria pelo portal e reabre concluída com motivo | D4 |
| | métricas mudam após criar/concluir | dashboards |
| | captura WhatsApp: preview não grava, commit grava com origem `captura_whatsapp` | D1 |
| | entrega vinculada a duas solicitações só aparece ao cliente após publicar | D2, D3 |
| | apresentação usa dados do período, é editável e só aparece ao cliente quando compartilhada | D5 |
| | OpenAPI documenta as rotas v1 | API |
| | MCP expõe ferramentas com schema e cria solicitação visível na API | D6 |
| | MCP respeita o escopo do tenant | D7 |
| | heurísticas: formatos do WhatsApp, saudações, categoria/prioridade, similaridade | D1 |
| | upload multipart: aceito, download autorizado, tipo proibido e tamanho recusados, cross-tenant 404 | D4, D7 |
| | seis criações simultâneas recebem números distintos | concorrência |

Também: `pnpm typecheck` (server e web sem erros) e `pnpm build` (build de produção do web concluído).

## Jornadas executadas na interface

Executadas com Playwright sobre a aplicação real (API + banco), em 1366×900 e 390×844. Capturas em `docs/evidencias/`:

| Demonstração | Capturas |
|---|---|
| D1 — captura WhatsApp (Ana, Cidade Engenharia) | `D1-captura-sugestoes.png` (repetida de CE-4 sinalizada, cortesias ignoradas), `D1-captura-registradas.png` |
| D2 — tratamento e entrega vinculada a duas solicitações | `D2-solicitacao-tratada.png`, `D2-nova-entrega.png`, `D2-entrega-publicada.png` (evidência + arquivo + publicação) |
| D3 — portal da Cidade sem notas internas | `D3-portal-inicio.png`, `D3-portal-novidades.png`, `D3-portal-novidade-detalhe.png`, `D3-portal-solicitacao-sem-notas-internas.png` |
| D4 — cliente da Marca abre solicitação com anexo | `D4-portal-nova-solicitacao.png`, `D4-portal-acompanhamento.png` |
| D5 — apresentação filtrada, edição, modo apresentação, PDF | `D5-gerar-apresentacao.png`, `D5-editor-narrativa.png`, `D5-editor-slide-entrega.png`, `D5-modo-apresentacao-capa.png`, `D5-modo-apresentacao-numeros.png`, `D5-exportar-pdf-pagina-de-impressao.png`, **`D5-apresentacao-exportada.pdf`** (9 páginas, gerado pelo motor do Chromium a partir da rota de impressão) |
| D6 — criação via API e MCP visível na UI | `D6-solicitacao-criada-via-MCP.png`; API verificada por `curl` (CE-14/CE-15 com origem `api`) |
| D7 — recurso de outro cliente bloqueado | `D7-portal-recurso-de-outro-cliente.png` (João abrindo URL de solicitação da Marca) |
| Componentes shadcn/ui | `solicitacoes-select-shadcn.png` (Select Radix aberto), `dialog-nova-solicitacao.png`, `dialog-nova-credencial.png`, `mobile-menu.png` (Sheet) |
| Camada de design (Recharts, cmdk, GSAP, Lenis) | `ui-visao-geral-graficos.png` (tendência mensal e sparklines), `ui-paleta-comandos.png` (Ctrl+K com busca no servidor), `ui-apresentacao-gsap.png` e `ui-apresentacao-evolucao.png` (revelação em cascata e gráfico animado no modo apresentação), `ui-portal-inicio.png`, `ui-portal-resultados-lenis.png` (`<html class="lenis">`) |
| Confirmações de ações irreversíveis | `ui-confirmacao-revogar.png` (revogar credencial nomeia a consequência; o mesmo diálogo cobre desativar usuário, compartilhar/parar de compartilhar apresentação e despublicar entrega) |
| Segunda rodada de refinamento | `ui-filtros-expandidos.png` (cinco chips de primeiro nível + painel "Filtros"), `ui-comentario-interno.png` (modo interno inconfundível; comentário público ganha "Desfazer" no toast, coberto pelo teste `autor desfaz o próprio comentário`), `mobile-solicitacao-triagem.png` (status e responsável logo abaixo do título em 375 px) |
| Responsividade e marca | `login-desktop.png`, `visao-geral-desktop.png`, `clientes.png`, `solicitacoes-lista.png`, `acessos-credenciais-auditoria.png`, `mobile-login.png`, `mobile-visao-geral.png`, `mobile-menu.png`, `mobile-portal-inicio.png`, `mobile-portal-nova-solicitacao.png` (sem rolagem horizontal) |

Logos: em todas as telas o logotipo/símbolo usados são os PNGs oficiais (`logo_claro` sobre fundos escuros, `logo_laranja` sobre claros, `simbolo_laranja` no cabeçalho mobile), sem recoloração.

## Verificações manuais adicionais

- `pnpm db:seed` executado duas vezes não duplica dados.
- `pnpm --filter server mcp:demo` criou CE-18 via STDIO e a solicitação apareceu no backoffice e no portal.
- `.agents/skills/impeccable/scripts/impeccable detect --json web/src` sem apontamentos.
