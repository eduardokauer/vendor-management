# Prompt para o Codex: {{INC_CODE}} {{INC_TITLE}}

Preencha este template por completo. Preserve as secoes fixas e substitua todos os placeholders por conteudo especifico da etapa.

## Leitura obrigatoria antes de qualquer coisa

Antes de analisar, planejar, alterar codigo, rodar testes, commitar ou abrir PR, leia por completo:

1. `docs/project_context.md`
2. `docs/codex_workflow.md`
3. Arquivos adicionais desta etapa:
   - {{FILES_TO_READ}}

Siga `docs/project_context.md` como fonte de verdade do estado e das decisoes do projeto.
Siga `docs/codex_workflow.md` como fonte de verdade do processo de execucao.
Se houver conflito entre suposicoes locais e o que estiver documentado nesses arquivos, prevalece o que estiver documentado.
Nao leia `docs/pm_workflow.md` por padrao, a menos que esta etapa mande explicitamente.

## Objetivo

{{OBJECTIVE}}

## Valor funcional esperado

{{FUNCTIONAL_VALUE}}

## Fora de escopo

{{OUT_OF_SCOPE}}

## Decisoes ja fechadas relevantes

{{CLOSED_DECISIONS}}

## Arquivos que devem ser atualizados nesta entrega

{{FILES_TO_UPDATE}}

Use este mapeamento quando aplicavel:
- mudou estado do sistema, decisao, operacao atual ou proximos passos -> atualizar `docs/project_context.md`
- mudou o processo esperado do executor tecnico -> atualizar `docs/codex_workflow.md`
- mudou o processo esperado do PM -> atualizar `docs/pm_workflow.md`

## Definition of Done (DoD)

{{DOD_ITEMS}}

## Validacoes obrigatorias

Execute e reporte com evidencia:

1. `docker compose --profile test run --rm backend-test`
2. {{ADDITIONAL_VALIDATIONS}}

Se alguma validacao estiver bloqueada por ambiente, mostre o erro real e explique a causa.

## Regras criticas de execucao

- Confirmar no codigo o estado real antes de alterar qualquer coisa.
- Implementar somente o necessario para cumprir o objetivo deste PR.
- Nao abrir escopo por conta propria.
- Nao reduzir a entrega a preparacao interna quando o objetivo exigir valor funcional visivel.
- Atualizar testes quando o risco ou o DoD exigirem.
- Fazer higiene final de encoding, BOM, mojibake e formatacao nos arquivos alterados.
- So commitar e abrir PR depois de DoD cumprido, documentacao/contexto atualizados e suite verde.

## Formato esperado da resposta final do Codex

1. Resumo do que foi feito.
2. Arquivos alterados.
3. Confirmacao explicita de que `docs/project_context.md` e `docs/codex_workflow.md` foram lidos e como a execucao respeitou esses arquivos.
4. Validacao explicita do DoD.
5. Resultado da suite.
6. Commit realizado.
7. Link ou nome do PR aberto.

## Regra final de commit e PR

Commite apenas no final, depois de toda validacao obrigatoria.
Abra o PR apenas no final, com titulo claro e corpo objetivo alinhado ao trabalho realizado.
