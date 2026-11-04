# OPTSOLV EXPERIENCE — HANDOFF SIMPLIFICADO

**Versão 2.0 — 03/11/2026** · **Destino:** agente de desenvolvimento Claude Fable 5.1 · **Idioma do produto:** pt-BR.

## 1. O produto em uma frase

Construir um **protótipo completo e funcional** de uma plataforma multi-cliente da **Optsolv**, que centraliza solicitações de usuários, registra melhorias e entregas, expõe **API e MCP** para agentes de IA e transforma o trabalho realizado em **resultados e apresentações executivas** compreensíveis aos clientes.

**Nome provisório:** *Optsolv Experience*. O nome do produto pode ser explorado criativamente. A marca corporativa deve ser escrita e representada como **Optsolv**, utilizando os arquivos oficiais disponibilizados.

## 2. O problema que precisamos resolver

Na Cidade Engenharia e na Marca Ambiental, demandas surgem em conversas de WhatsApp e são tratadas pelos desenvolvedores/analistas. A execução pode acontecer rapidamente, mas há dificuldade para registrar, acompanhar, consultar histórico e demonstrar o que foi entregue. Na Cidade Engenharia a comprovação de valor para a direção é especialmente importante.

A solução não é apenas um help desk: é uma plataforma **solicitação → trabalho → entrega → evidência → valor comunicado**.

## 3. Escopo prioritário (é o produto, não só um MVP visual)

1. **Multi-cliente real:** colaboradores internos enxergam seus clientes/projetos; clientes externos só enxergam seus próprios dados; isolamento garantido no backend.
2. **Solicitações:** criação, organização, acompanhamento, comentários, anexos, histórico, origem WhatsApp (por colagem assistida), portal e API.
3. **Entregas e valor:** registrar o que foi resolvido, vincular uma entrega a múltiplas solicitações, registrar evidências e mostrar benefícios **sem inventar resultados**.
4. **Apresentações:** gerar, visualizar, editar títulos/narrativas essenciais e exportar uma apresentação executiva baseada em entregas reais da aplicação.
5. **APIs:** CRUD essencial e documentação OpenAPI, compartilhando a mesma lógica e autenticação da aplicação.
6. **MCP:** servidor local funcional com ferramentas para agentes consultarem e registrarem solicitações/entregas, sujeito a autorização e escopo.

### Fora deste ciclo

- **Não integrar Azure DevOps** nem criar qualquer dependência dele.
- Não automatizar a leitura dos grupos de WhatsApp existentes. Começar com entrada por colagem/importação manual assistida.
- Não criar integrações externas obrigatórias, microserviços desnecessários ou dependência de credenciais de terceiros para executar a demonstração.
- Não construir módulos de gestão completa de sprints, CI/CD, CRM, faturamento ou help desk omnichannel avançado.

## 4. Como usar este pacote

Leia nesta ordem:

1. `01_PRODUTO_E_FLUXOS.md` — o que construir e como o cliente utiliza.
2. `02_ARQUITETURA_APIS_MCP.md` — contratos mínimos e regras de engenharia.
3. `03_DIRECAO_CRIATIVA_E_MARCA.md` — liberdade visual e uso correto dos logos.
4. `04_PROMPT_MESTRE_FABLE_5_1.md` — comando principal a fornecer ao agente.
5. `assets/marca_oficial/` — **fonte da verdade** dos logos.

Se for enviar para outro agente, **anexe o ZIP inteiro** e cole o conteúdo do arquivo `04_PROMPT_MESTRE_FABLE_5_1.md` como primeira instrução.

## 5. O que caracteriza “funcional”

- Interface e backend operando sobre **dados persistidos**, com fluxos navegáveis e alterações reais.
- Usuários de demonstração com permissões distintas por cliente; ações autorizadas no servidor.
- API e MCP executando operações sobre os **mesmos registros** mostrados na interface.
- Relatórios e apresentações baseados em dados reais do banco, não cards com números estáticos.
- Integrações ou IA opcionais marcadas como `demo/mock` quando simuladas; nenhuma função apenas decorativa ou botão inerte nas jornadas principais.
- Repositório, configuração local, seed fictício, documentação de execução e testes demonstráveis.

## 6. Liberdade criativa intencional

Este handoff descreve o **problema, os comportamentos e os resultados**; não determina a composição de telas, tipografia, grid, tokens, layout, estilo de animação ou biblioteca de componentes. O agente deve propor uma linguagem visual própria, premium, extremamente simples de utilizar, com **laranja de interface um pouco mais claro** que o laranja tradicional da marca. **A cor e o desenho dos logos oficiais não podem ser alterados.**

> Hierarquia das decisões: isolamento/segurança → funcionamento real → clareza de UX → qualidade visual e animações. O agente tem autonomia para decisões não bloqueantes, registrando-as de modo breve no README.
