# 01 — PRODUTO, TELAS E FLUXOS ESSENCIAIS

## Pessoas e acessos

| Papel | Precisa fazer |
|---|---|
| Administrador Optsolv | Ver todos os clientes autorizados, criar clientes/projetos, acompanhar solicitações/entregas, gerar relatórios e gerenciar acessos. |
| Colaborador Optsolv | Criar e tratar solicitações de projetos atribuídos, registrar evidências/entregas e preparar apresentações. |
| Usuário do cliente | Abrir solicitações, comentar, anexar arquivos, acompanhar status e visualizar entregas, novidades e relatórios compartilhados de seu cliente. |

A interface interna deve permitir trocar entre o contexto de clientes autorizados. No portal do cliente, **nenhum dado de outro cliente** pode ser retornado pela API, mesmo se alguém tentar alterar IDs ou URLs. Comentários internos jamais aparecem no portal.

## Capacidades e o comportamento esperado

### A. Gestão multi-cliente

- Criar/editar clientes, projetos, usuários associados e configurações básicas.
- Cada solicitação, entrega, evidência e apresentação pertence a um cliente e, quando aplicável, a um projeto.
- Visão global para a Optsolv e visão filtrada por cliente/projeto.
- Estados vazios e início guiado para novos clientes.

### B. Solicitações (núcleo operacional)

O cadastro deve ser **muito rápido**: título opcional gerado a partir da descrição, texto livre, projeto, categoria opcional e anexos. Categorias sugeridas: **problema**, **melhoria**, **nova funcionalidade**, **dúvida**. A classificação pode ser alterada pela equipe.

Fluxo simplificado: `Nova → Em triagem → Planejada → Em andamento → Aguardando cliente → Concluída`, com opção de **Cancelada**. Nem toda demanda precisa atravessar todos os estados. Reabertura exige motivo e gera histórico. Cliente acompanha somente o estado público e comentários públicos.

Cada solicitação pode conter: origem (`portal`, `admin`, `captura_whatsapp`, `api`, `mcp`), autor, cliente/projeto, responsável, prioridade, status, comentários públicos/internos, anexos, datas e histórico. Registro de tempo e SLA podem ser futuros, não centrais neste protótipo.

**Captura WhatsApp na primeira versão:** usuário interno cola várias mensagens; a plataforma as transforma em sugestões revisáveis de solicitações, detecta possíveis repetidas por heurística simples e só grava após confirmação humana. Não alegar conexão automática a grupos. A análise pode funcionar sem chave de IA por um modo demonstrativo explícito.

### C. Entregas e evidências

- Registrar uma entrega com nome, resumo claro, projeto, data, status (`rascunho`, `publicada`), responsável e evidências.
- Vincular **uma entrega a múltiplas solicitações** e **uma solicitação a múltiplas entregas**.
- Preservar referência de origem da solicitação; adicionar texto, arquivo, imagem ou link como evidência da entrega.
- Registrar como a entrega melhorou a experiência ou resolveu um problema, separando **benefício observado**, **benefício esperado** e **impacto medido**.
- Exibir novidades ao cliente apenas quando publicadas/compartilhadas; notas internas continuam protegidas.

**Regra fundamental:** solicitação ≠ entrega ≠ resultado. Número de demandas concluídas não equivale automaticamente a horas economizadas, receita gerada ou retorno financeiro. A IA pode sugerir redação, mas não inventar medidas nem atribuições causais.

### D. Dashboards e demonstração de valor

Painel da Optsolv: clientes/projetos ativos, demandas abertas/concluídas, andamento, entregas publicadas, evolução por período, solicitações sem responsável e destaque de entregas com evidência.

Painel do cliente: resumo simples do que solicitou, do que recebeu, últimas novidades e próximos passos públicos. Filtrar por projeto e intervalo de datas.

Apresentações executivas: selecionar **cliente + projetos + período**, gerar slides a partir dos dados existentes, permitir editar título/texto antes de compartilhar, abrir em modo apresentação e oferecer **exportação PDF via impressão ou geração equivalente**. O relatório tem que conseguir mostrar: contexto, solicitações relevantes, entregas, benefícios/evidências, evolução e próximos passos. Se não há dado, não preencher com inventado: indicar “não informado”. Cada item importante deve permitir acessar sua fonte interna; a visão compartilhável remove dados sigilosos.

### E. APIs e MCP

Todos os fluxos fundamentais da interface devem estar apoiados pela mesma API utilizada por agentes. O MCP expõe **ferramentas concretas**, não prompts de exemplo desconectados. As permissões são verificadas em cada operação e a plataforma mantém o histórico da origem.

## Sugestão de mapa de telas (agente pode reorganizar)

**Optsolv Admin:** visão geral · clientes · projetos · caixa de entrada/captura · solicitações · entregas · relatórios/apresentações · configurações de acesso e API.

**Portal do cliente:** início · minhas solicitações · nova solicitação · novidades/entregas · resultados/relatórios compartilhados.

Além das listas, implementar páginas de detalhe, formulários, filtros, feedback de sucesso/erro, loading, empty state, navegação mobile e ações operantes. **Não** é necessário replicar exatamente essa arquitetura de menu se o agente encontrar solução melhor.

## Três jornadas que precisam funcionar ponta a ponta

**Jornada 1 — WhatsApp para entrega:** colaborador escolhe Cidade Engenharia → cola mensagens fictícias → revisa duas sugestões → cria solicitações → atribui e atualiza status → registra entrega com evidência → vincula as solicitações → publica novidade → cliente vê a entrega.

**Jornada 2 — Cliente para atendimento:** usuário fictício da Marca Ambiental entra no portal → abre demanda e anexa imagem → acompanha o status → comenta → equipe responde e conclui → cliente visualiza histórico sem notas internas.

**Jornada 3 — Valor para a direção:** administrador filtra Cidade Engenharia por período → visualiza números calculados → seleciona entregas → gera apresentação navegável → ajusta mensagem executiva → apresenta/exporta PDF → retorna às evidências de cada entrega.

## Dados de demonstração

Criar **dois clientes ficticiamente preenchidos**, usando os nomes Cidade Engenharia e Marca Ambiental apenas como cenários. Exemplo, sem afirmar ocorrências reais:

- Cidade Engenharia: solicitações ilustrativas para cadastro de visitas, filtros de busca e etapa de aprovação; entregas de UX e correções de fluxo; uma apresentação executiva com evidências fictícias identificadas.
- Marca Ambiental: solicitações ilustrativas de navegação mobile, upload de documentos e mensagens de erro; algumas abertas, outras concluídas; portal e relatório independentes.
- Diferentes colaboradores e usuários externos, anexos de exemplo não confidenciais e datas variadas para testar gráficos/filtros.

**Toda métrica apresentada deve derivar desses dados persistidos.** Os nomes são apenas cenários de demo; o conteúdo é inventado para fins de prototipação.

## Critérios mínimos de aceite de produto

1. Administrador cria cliente e projeto e enxerga dados corretamente segregados.
2. Cliente abre demanda, adiciona anexo e a vê no histórico.
3. Interno adiciona comentário privado; cliente não consegue visualizá-lo nem pela API.
4. Colagem de WhatsApp gera propostas de tickets, com revisão antes do cadastro.
5. Alterar status/atribuição atualiza dashboard e histórico.
6. Uma entrega vincula duas solicitações e fica visível ao cliente após publicação.
7. Relatório e apresentação usam dados filtrados do banco; mudanças nos dados aparecem na próxima geração.
8. Apresentação abre em modo slide e pode ser exportada de forma utilizável.
9. Usuário Cidade Engenharia não acessa dados Marca Ambiental, nem por ID direto.
10. API e MCP criam/consultam registros que aparecem na interface, respeitando autorização.
