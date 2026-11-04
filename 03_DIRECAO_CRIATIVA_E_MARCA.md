# 03 — DIREÇÃO CRIATIVA E USO DA MARCA

## O que queremos sentir ao utilizar

Uma plataforma **premium, moderna, fluida, inovadora e surpreendentemente simples**. Precisa causar uma ótima primeira impressão, mas seu maior mérito deve ser reduzir atrito para quem abre uma solicitação e oferecer clareza para quem acompanha resultados. Não desejo um dashboard genérico com dezenas de cards de mesma aparência.

O agente tem **liberdade criativa total** para explorar:

- Conceitos visuais, identidade do produto, composição editorial, navegação, disposição de cards, tipografia e iconografia.
- Estruturas de telas e formas de visualizar progresso, solicitações e entregas.
- Modo claro/escuro, animações, transições, microinterações e apresentações cinematográficas (sem prejudicar usabilidade).
- Componentes, bibliotecas, motion e efeitos modernos, priorizando coerência e performance.

Não fixar uma lista de design tokens, uma fonte, um grid ou uma biblioteca obrigatória. O usuário quer que o Fable 5.1 **crie e decida**, e não simplesmente reproduza uma especificação visual fechada.

## Laranja: interface mais leve, logotipo inalterado

- O **laranja deve ser a cor visual protagonista** do produto.
- Explorar uma família de laranjas **ligeiramente mais clara, luminosa e agradável** que o laranja tradicional do logo. Por exemplo, `#FF7045` pode servir como **ponto de partida experimental**, não como cor mandatória.
- O agente pode explorar tons próximos, gradientes sutis, bases claras ou escuras e contrastes sofisticados.
- **Não recolorir o logotipo oficial** para combinar com o novo laranja da interface. A marca e os assets permanecem exatamente como fornecidos.

## Logos oficiais: regra obrigatória de ponta a ponta

A pasta `assets/marca_oficial/` contém o **PDF original vetorial com 16 pranchas** e exports PNG transparentes feitos diretamente dele para facilitar integração. Existem variantes laranja, preto e claro e versões do símbolo. **Não redesenhar, gerar com IA, modificar as proporções, substituir a tipografia, criar uma versão parecida ou aplicar efeitos que deformem o logo.**

Regras práticas:

1. Usar o logotipo oficial nas superfícies de marca (login, navegação, cabeçalho, apresentações e materiais exportados); escolher versão de contraste adequada ao fundo.
2. Para telas pequenas, quando couber, utilizar o **símbolo oficial isolado**, extraído do arquivo fornecido.
3. Preservar transparência, proporção e respiro; nunca comprimir horizontalmente, cortar a palavra ou misturar versões.
4. Usar as versões claras sobre superfícies escuras somente quando legíveis; usar laranja/preto em fundos claros conforme contexto.
5. Não inventar logo de Cidade Engenharia nem Marca Ambiental; se não houver asset autorizado, usar identidade textual discreta ou iniciais.
6. Manter consistência entre portal do cliente, admin, widget eventual, screenshots e apresentação.

### Assets fornecidos

| Arquivo | Origem | Uso típico |
|---|---|---|
| `Optsolv_Logo_RGB_OFICIAL.pdf` | PDF original integral | Fonte da verdade e variantes. |
| `logo_laranja.png` | Página 1 do PDF | Logotipo principal em superfícies adequadas. |
| `logo_claro.png` | Página 2 | Logotipo claro sobre fundos escuros. |
| `logo_preto.png` | Página 3 | Alternativa neutra sobre fundos claros. |
| `simbolo_laranja.png` | Página 13 | Ícone/assinatura compacta. |
| `simbolo_claro.png` | Página 14 | Símbolo sobre fundos escuros. |
| `simbolo_preto.png` | Página 15 | Símbolo em alto contraste. |

Os PNGs foram renderizados do PDF original, sem reprojeto do símbolo ou alteração de cor. Se o frontend suportar melhor outro formato, converter **a partir do original**, preservando a geometria e a cor, e verificar visualmente o resultado.

## Referências para exploração (não obrigação de uso)

- https://bklit.com/ — visualização de dados.
- https://kokonutui.com/ — componentes contemporâneos.
- https://www.reactbits.dev/ — pequenos efeitos expressivos.
- https://gsap.com/ — animações controladas.
- https://animejs.com/documentation/ — motion e SVG.
- https://lenis.dev/ — experiências com rolagem suave, quando apropriado.

**Evitar** usar todas simultaneamente sem justificativa; não sacrificar velocidade, acessibilidade e manutenção para demonstrar efeitos. Preferir animações com propósito e respeitar `prefers-reduced-motion`.

## Referências de UX e qualidade

O portal do cliente deve ser mais simples que o admin. Campos essenciais primeiro, uso confortável em celular, textos em português natural, feedbacks claros e navegação acessível. O painel executivo deve priorizar legibilidade, explicação e evidências, não excesso de gráficos. Prever estados vazios, falhas, sucesso, carregamento, foco por teclado, contraste adequado e responsividade.

**Processo criativo sugerido:** o agente explora duas direções de alto nível, escolhe autonomamente a mais coerente, implementa um conjunto de componentes consistente e documenta em poucas linhas por que a escolheu. Não solicitar aprovação de microdecisões de design.
