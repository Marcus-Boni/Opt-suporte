---
name: optsolv-suporte-widget
description: Implementa o widget de suporte Optsolv Suporte numa solução da Optsolv (botão flutuante + rota de backend que registra solicitações pela API, com token só no servidor). Use ao adicionar, revisar ou corrigir o widget de suporte, o botão "Suporte", a abertura de chamados ou a integração com a Optsolv Suporte API.
when_to_use: Pedidos como "adicionar o widget de suporte", "botão para abrir chamado na Optsolv", "integrar com o Optsolv Suporte", "registrar solicitação pela API da Optsolv" ou revisar uma integração existente.
argument-hint: "[caminho da app ou nome da solução]"
---

# Widget Optsolv Suporte

Implemente o widget seguindo a especificação em [especificacao.md](especificacao.md). Leia o arquivo inteiro antes de escrever código: ele define arquitetura, contrato da API, interface e critérios de aceite.

## Fluxo

1. **Reconheça o projeto.** Descubra o framework do front e do back, o sistema de autenticação (de onde vem o nome da pessoa logada), o design system, o padrão de rotas, como variáveis de ambiente são lidas e como os testes rodam. Em monorepo, trabalhe no app indicado em `$ARGUMENTS` ou pergunte qual.
2. **Mostre o plano antes de editar:** arquivos a criar ou alterar, onde o widget é montado (layout autenticado) e onde a rota do backend fica.
3. **Backend primeiro:** rota BFF com validação, autor vindo da sessão, limite por pessoa, repasse do `Idempotency-Key`, tempo limite, anexos e logs sem conteúdo. Variáveis `OPTSOLV_*` só no servidor e documentadas no `.env.example` do projeto, sem valores reais.
4. **Widget depois:** componente com os componentes e tokens da solução, acessível e com os estados de carregando, erro, sucesso e rascunho.
5. **Testes:** os do BFF listados nos critérios de aceite, com a API da Optsolv simulada. Nunca chame a API real nos testes automatizados.
6. **Verifique:** rode testes, tipos e build; confirme que não há `osk_` no bundle do navegador; percorra os critérios de aceite e diga quais ficaram pendentes.

## Regras

- O token `OPTSOLV_API_TOKEN` nunca chega ao navegador, a logs ou ao controle de versão.
- Não invente campos: use só o contrato da especificação. Na dúvida, consulte `${OPTSOLV_API_URL}/docs`.
- Reaproveite o que o projeto já tem (cliente HTTP, validação, componentes de diálogo, toasts) em vez de adicionar dependências.
- Sem credenciais para testar de verdade, entregue com a API simulada e diga como validar em homologação.
