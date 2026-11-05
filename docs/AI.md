# IA na captura de mensagens

A **Captura WhatsApp** usa um modelo do **Microsoft Foundry** (projeto `ai-painel-estrategico`) para transformar mensagens coladas em sugestões de solicitação. Uma pessoa revisa tudo antes de gravar.

## O que a IA faz (e o que não faz)

| Etapa | Quem faz |
|---|---|
| Ler o texto colado, separar remetentes, datas e agrupar mensagens em blocos | Regras locais (determinístico) |
| Descartar cortesias óbvias ("ok", "bom dia", emojis) | Regras locais (nem vão para o modelo) |
| Decidir se o bloco tem demanda; escrever o título; categoria; prioridade; confiança | **IA** |
| Descrição da solicitação | Texto original da mensagem (a IA não reescreve fatos) |
| Detectar possíveis repetidas de solicitações abertas | Regras locais (similaridade de termos) |
| Gravar | **Só após revisão humana** |

Se a IA não estiver configurada ou falhar (permissão, limite de uso, tempo excedido, formato inválido), a captura **continua funcionando com as regras locais** e a tela informa o motivo. O modo usado (`heuristica` ou `ia:<implantação>`) fica registrado na mensagem de origem e na auditoria.

## Arquitetura

```
Intake.tsx ──POST /intake/whatsapp-preview──▶ previewWhatsApp (services/intake.ts)
                                                 ├─ parseWhatsApp + groupBlocks (regras)
                                                 ├─ analyzeBlocks (services/intake-ai.ts)
                                                 │    ├─ maskPii → JSON com { index, text }
                                                 │    └─ foundryJson (lib/ai.ts) ──▶ Foundry · Responses API v1
                                                 └─ repetidas por similaridade (regras)
```

- **Chamada direta ao modelo** (Responses API v1, `https://<conta>.openai.azure.com/openai/v1/`), sem agente: é uma extração estruturada de uma etapa, mais rápida e simples de testar.
- **Saída em JSON Schema estrito** (`text.format: json_schema, strict: true`) e validada de novo com Zod; índices inventados são descartados, confiança limitada a 0–1, título limitado a 140 caracteres.
- **Lotes de 25 blocos**, no máximo 3 chamadas simultâneas; o SDK repete 429/5xx com backoff (2 tentativas); timeout de 30 s (`AI_TIMEOUT_MS`).
- `store: false`: o conteúdo não é guardado no serviço.

## Segurança e privacidade

- **Sem chaves:** autenticação **Entra ID**. Em desenvolvimento, `DefaultAzureCredential` (o `az login` de quem roda); em produção, `ManagedIdentityCredential` (identidade gerenciada; `AZURE_CLIENT_ID` para identidade atribuída pelo usuário).
- **Papel necessário** para a identidade na conta Foundry: `Cognitive Services OpenAI User` (ou `Azure AI User`).
- **Minimização de dados (LGPD):** o modelo recebe só o texto dos blocos. Remetente não é enviado; e-mails, telefones, CPF e CNPJ são trocados por `[email]`, `[telefone]`, `[documento]` antes do envio.
- **Injeção de prompt:** as mensagens vão como **dado em JSON**, as instruções dizem para ignorar ordens contidas nelas e a saída é presa a enums. Quando o **filtro de conteúdo do Azure** (Prompt Shields) recusa um lote, o lote é dividido ao meio até isolar o bloco problemático: só ele fica com as regras e recebe um aviso na revisão.
- **Sem números inventados:** a IA classifica e resume; não cria prazos, impactos nem métricas.

## Configuração

Em `server/.env`:

```
AZURE_OPENAI_ENDPOINT=https://ai-painel-estrategico.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-6.1-sol
# Opcionais
# AI_INTAKE_ENABLED=false      desliga a IA (só regras)
# AI_TIMEOUT_MS=30000
```

Sem `AZURE_OPENAI_ENDPOINT`, a captura usa só as regras locais.

## Avaliação e escolha do modelo

`pnpm --filter server ai:eval` roda o conjunto rotulado de `server/scripts/intake-eval.json` contra o Foundry (inclui casos de conversa social, tentativa de injeção e dados pessoais) e mede acerto de "há demanda?", categoria e urgência, tempo e tokens.

Resultado em 04/11/2026 (12 casos, prompt `intake-v1`):

| Implantação | Há demanda? | Categoria | Urgência | Tempo | Tokens |
|---|---|---|---|---|---|
| gpt-6-luna | 100% | 90% | 100% | 5,2 s | 2.088 |
| **gpt-6.1-sol** (padrão) | 100% | **100%** | 100% | 7,8 s | 1.871 |
| Regras locais | não distingue conversa social | 90% | — | — | — |

Ao mudar o prompt (`PROMPT_VERSION` em `services/intake-ai.ts`) ou a implantação, rode a avaliação de novo e compare.

## Testes

`server/test/intake-ai.test.ts` cobre, com um modelo simulado (sem rede): IA desligada, validação da saída, resposta fora do formato, isolamento de bloco recusado pelo filtro, mascaramento de dados pessoais, preview ponta a ponta pela API, fallback com motivo e registro do modo no commit. A suíte nunca chama o Foundry (`AZURE_OPENAI_ENDPOINT` vazio nos testes).
