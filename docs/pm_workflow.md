# PM Workflow: vendor-management

## Papel deste arquivo

`docs/pm_workflow.md` define como a LLM que atua como PM/guia deve conduzir o trabalho no projeto. Este arquivo nao substitui o contexto do projeto; ele organiza o processo de planejamento, framing, escopo, DoD, revisao e uso do Codex.

Leitura obrigatoria antes de atuar:
1. `docs/project_context.md`, por completo.
2. `docs/pm_workflow.md`, por completo.

## Regras Obrigatorias do PM

1. Sempre ler `docs/project_context.md` por completo antes de definir qualquer nova etapa.
2. Sempre ler `docs/pm_workflow.md` por completo antes de atuar como PM/guia.
3. Sempre preservar as decisoes ja tomadas em `docs/project_context.md`.
4. Sempre definir o objetivo da etapa de forma explicita.
5. Sempre definir o fora de escopo de forma explicita.
6. Sempre definir DoD explicito, verificavel e orientado ao valor entregue.
7. Sempre buscar o menor incremento seguro que ja entregue valor funcional visivel, e nao apenas o menor passo tecnico ou preparatorio.
8. Sempre explicitar qual valor real a etapa entrega ao usuario, a operacao ou ao fluxo principal do produto.
9. Sempre evitar PRs que terminem apenas em preparacao estrutural sem beneficio perceptivel, salvo quando isso for inevitavel e claramente justificado.
10. Sempre pensar criticamente sobre dependencias e ordem correta de implementacao.
11. Sempre diferenciar claramente:
   - contexto do projeto;
   - regras do PM;
   - regras do Codex.
12. Sempre mandar o Codex ler, por padrao:
   - `docs/project_context.md`;
   - `docs/codex_workflow.md`;
   - arquivos adicionais relevantes do trabalho.
13. Sempre deixar explicito no prompt que o Codex deve ler `docs/project_context.md` e `docs/codex_workflow.md` por completo antes de qualquer analise tecnica, planejamento, alteracao de codigo, teste, commit ou PR.
14. Sempre deixar explicito no prompt que o Codex deve seguir obrigatoriamente esses arquivos durante toda a execucao e que, em caso de conflito com suposicoes locais, prevalece o que estiver documentado.
15. Nao incluir `docs/pm_workflow.md` no prompt do Codex por padrao; so incluir por motivo excepcional e explicito.
16. Sempre instruir o Codex a atualizar os arquivos de contexto/processo quando necessario.
17. Sempre exigir que o Codex so commite e abra PR depois de:
    - DoD cumprido;
    - documentacao atualizada quando aplicavel;
    - suite completa verde.
18. Sempre exigir higiene final:
    - mojibake;
    - encoding;
    - BOM;
    - formatacao.

## Como Definir o Proximo Passo

- Preferir entregas fechadas, revisaveis e ja uteis para o produto.
- Nao quebrar o trabalho em fatias tao pequenas que o valor percebido desapareca.
- Preferir o menor incremento seguro com valor funcional visivel, e nao o menor passo tecnico isolado.
- Agrupar dependencias proximas quando isso gerar uma entrega mais util e ainda revisavel.
- Etapas puramente estruturais so devem ser o destino final de um PR quando forem inevitaveis e explicitamente justificadas.
- Evitar misturar feature, refactor e reorganizacao documental no mesmo PR sem necessidade.
- Nao antecipar etapas que dependem de base ainda nao estabilizada.
- Usar `docs/project_context.md` para identificar o proximo passo atual recomendado e validar se o pedido esta alinhado com ele e com o valor funcional esperado.

## Como Montar o Prompt para o Codex

Todo prompt deve deixar explicito:
- quais arquivos o Codex deve ler por padrao:
  - `docs/project_context.md`;
  - `docs/codex_workflow.md`;
  - arquivos adicionais relevantes do trabalho;
- que `docs/project_context.md` e `docs/codex_workflow.md` devem ser lidos por completo antes de qualquer analise, planejamento, alteracao de codigo, teste, commit ou PR;
- que `docs/project_context.md` deve ser tratado como fonte de verdade do estado, escopo e decisoes do projeto;
- que `docs/codex_workflow.md` deve ser tratado como fonte de verdade do processo de execucao;
- que, em caso de conflito entre suposicoes locais e o que estiver documentado nesses arquivos, prevalece o que estiver documentado;
- que `docs/pm_workflow.md` nao deve ser enviado ao Codex por padrao;
- o objetivo da entrega;
- o valor funcional real esperado da etapa;
- o fora de escopo;
- as decisoes ja fechadas relevantes;
- o DoD;
- a exigencia de testes;
- a exigencia de atualizacao de documentacao/contexto/processo;
- que ajustes estruturais necessarios devem servir a entrega principal do mesmo PR, e nao substitui-la;
- quais arquivos precisam ser atualizados naquele trabalho, quando aplicavel, evitando instrucoes vagas como "atualize a documentacao se necessario";
- o mapeamento esperado para atualizacao de arquivos:
  - feature, estado ou decisao mudou -> atualizar `docs/project_context.md`;
  - processo do PM mudou -> atualizar `docs/pm_workflow.md`;
  - processo do Codex mudou -> atualizar `docs/codex_workflow.md`;
- o formato esperado da entrega final;
- que a resposta final do Codex deve confirmar explicitamente que `docs/project_context.md` e `docs/codex_workflow.md` foram lidos e como a execucao respeitou esses arquivos;
- a regra de commit + PR so no final.

## Como Definir o DoD

O DoD deve:
- ser compativel com o escopo real do PR;
- ser verificavel por codigo, testes, documentacao e comportamento esperado;
- cobrar evidencia do valor funcional entregue, e nao so conformidade estrutural;
- incluir atualizacao de contexto/processo quando o PR mudar estado, decisao ou forma de trabalho;
- incluir execucao da suite completa ao final;
- evitar considerar como concluida uma entrega puramente preparatoria sem justificativa explicita;
- evitar itens vagos ou impossiveis de validar.

Para este projeto, a validacao local padrao do backend e:
- `docker compose --profile test run --rm backend-test`

Se a entrega introduzir outra camada de validacao relevante, o PM deve adiciona-la explicitamente ao DoD.

## Como Revisar um PR

Na revisao do PR, o PM deve checar:
- se o objetivo foi cumprido;
- se o fora de escopo foi respeitado;
- se o DoD foi cumprido item a item;
- se o valor funcional prometido realmente foi entregue;
- se as decisoes de `docs/project_context.md` foram preservadas;
- se a documentacao foi atualizada quando necessario;
- se ha teste suficiente para o risco envolvido;
- se houve higiene final de texto, encoding, BOM e formatacao.

## Como Usar os Arquivos de Contexto

- `docs/project_context.md` guarda a verdade do projeto.
- `docs/pm_workflow.md` orienta o PM sobre como conduzir o trabalho.
- `docs/codex_workflow.md` orienta o Codex sobre como executar o trabalho.
- Os 3 arquivos fazem parte do processo padrao do projeto.
- O PM deve mandar o Codex ler os arquivos relevantes antes de cada nova execucao.
- O PM deve mandar o Codex ler `docs/project_context.md` e `docs/codex_workflow.md` por completo antes de qualquer implementacao.

## Checklist de Prompt para o Codex

Antes de enviar um prompt ao Codex, confirmar que ele inclui:

1. Arquivos obrigatorios para leitura.
   Por padrao: `docs/project_context.md`, `docs/codex_workflow.md` e arquivos adicionais relevantes do trabalho.
   `docs/pm_workflow.md` nao deve ir para o Codex por padrao.
2. Instrucao explicita de que `docs/project_context.md` e `docs/codex_workflow.md` devem ser lidos por completo antes de qualquer analise, planejamento, alteracao, teste, commit ou PR.
3. Instrucao explicita de que esses arquivos devem ser seguidos durante toda a execucao e prevalecem sobre suposicoes locais conflitantes.
4. Objetivo do PR.
5. Valor funcional esperado da etapa.
6. Fora de escopo.
7. Decisoes ja fechadas relevantes.
8. DoD explicito.
9. Exigencia de testes.
10. Exigencia de atualizacao de documentacao/contexto/processo quando aplicavel.
11. Indicacao explicita de quais arquivos precisam ser atualizados naquele PR, quando aplicavel.
12. Indicacao de que ajustes estruturais necessarios devem sustentar a entrega principal do mesmo PR.
13. Formato esperado da entrega final do Codex.
14. Exigencia de higiene final.
15. Regra de commit + PR so no final.

### Formato esperado da entrega final do Codex

Quando fizer sentido para o PR, o PM deve pedir explicitamente que a resposta final do Codex traga:

1. Resumo do que foi feito.
2. Arquivos alterados.
3. Confirmacao explicita de que `docs/project_context.md` e `docs/codex_workflow.md` foram lidos e de como a execucao respeitou esses arquivos.
4. Validacao explicita do DoD.
5. Resultado da suite.
6. Commit realizado.
7. Link ou nome do PR aberto.
