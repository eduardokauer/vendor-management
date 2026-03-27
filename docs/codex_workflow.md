# Codex Workflow: vendor-management

## Papel deste arquivo

`docs/codex_workflow.md` define como o Codex deve executar trabalho tecnico neste projeto. Este arquivo nao substitui o contexto do projeto; ele organiza leitura obrigatoria, respeito a escopo, testes, atualizacao de documentacao, validacao final e regras para commit/PR.

Leitura obrigatoria antes de executar:
1. `docs/project_context.md`, por completo.
2. `docs/codex_workflow.md`, por completo.
3. Quaisquer outros arquivos que o prompt mandar ler antes de comecar.

Essas leituras devem acontecer antes de qualquer analise tecnica, planejamento, alteracao de codigo, teste, commit ou PR.

`docs/pm_workflow.md` nao faz parte da leitura padrao do Codex. Ele so deve ser lido se o prompt mandar explicitamente por motivo especifico.

## Regras Obrigatorias do Codex

1. Sempre ler `docs/project_context.md` por completo antes de qualquer analise tecnica, planejamento, alteracao de codigo, teste, commit ou PR.
2. Sempre ler `docs/codex_workflow.md` por completo antes de qualquer analise tecnica, planejamento, alteracao de codigo, teste, commit ou PR.
3. Sempre considerar `docs/project_context.md` como base prioritaria de contexto do projeto.
4. Sempre considerar `docs/codex_workflow.md` como base prioritaria do processo de execucao.
5. Sempre ler tambem os arquivos adicionais indicados no prompt.
6. Nao ler `docs/pm_workflow.md` por padrao; so faze-lo se o prompt mandar explicitamente por motivo especifico.
7. Nao contradizer decisoes ja tomadas em `docs/project_context.md`.
8. Em caso de conflito entre suposicoes locais e o que estiver documentado em `docs/project_context.md` ou `docs/codex_workflow.md`, prevalece o que estiver documentado.
9. Respeitar objetivo, fora de escopo e DoD do prompt, preservando o valor funcional prometido para a entrega.
10. Nao abrir escopo por conta propria.
11. Nao reduzir o escopo por conta propria a ponto de sobrar apenas preparacao interna quando o objetivo do PR exigir valor funcional visivel.
12. Usar ajustes estruturais apenas como suporte a entrega principal do mesmo PR, e nao como substituto dela.
13. Transformar itens criticos do DoD em testes sempre que possivel.
14. Revisar os arquivos alterados quanto a:
   - mojibake;
   - encoding incorreto;
   - BOM residual;
   - problemas de formatacao.
15. Executar a suite completa antes de considerar a entrega concluida.

## Regra Critica de Atualizacao dos Arquivos

O Codex deve manter estes arquivos atualizados sempre que necessario.

### Atualizar `docs/project_context.md` quando mudar

- estado do sistema;
- decisoes do projeto;
- operacao atual;
- proximos passos recomendados;
- criterio de priorizacao das proximas iteracoes;
- limitacoes relevantes.

### Atualizar `docs/pm_workflow.md` quando mudar

- o processo esperado da LLM/PM;
- a forma de estruturar prompts;
- a forma de definir DoD;
- a forma de revisar PRs;
- a forma de conduzir o trabalho.

### Atualizar `docs/codex_workflow.md` quando mudar

- o processo esperado do executor tecnico;
- o criterio esperado de fatiamento e preservacao de valor da entrega;
- regras de validacao;
- regras de testes;
- regras de documentacao;
- regras de commit;
- regras de abertura de PR.

### Regra de conclusao

- Se uma entrega alterar contexto ou processo e o arquivo correspondente nao for atualizado, a entrega **nao esta completa**.

## Como Executar uma Entrega

1. Ler por completo os arquivos obrigatorios.
2. So depois dessas leituras, entender objetivo, fora de escopo e DoD.
3. Confirmar no codigo o estado real antes de alterar qualquer coisa.
4. Implementar somente o necessario para o objetivo do PR, preservando o incremento funcional prometido.
5. Nao parar em preparacao interna quando o prompt pedir valor funcional visivel; incorporar os ajustes estruturais necessarios na mesma entrega sempre que isso continuar seguro e revisavel.
6. Atualizar testes quando o DoD ou o risco exigir.
7. Atualizar documentacao/contexto/processo quando necessario.
8. Validar se o valor prometido ficou perceptivel ao final da entrega, alem de checar testes e documentacao.
9. Fazer higiene final dos arquivos alterados.
10. Rodar a suite completa de testes, garantindo que todos os testes estejam passando.
11. Caso algum erro seja encontrado durante a suite completa de testes, fazer os ajustes e testar novamente. Efetuar esse ciclo ate a suite completa de testes estar passando completamente.
12. So entao considerar commit e PR.

## Regras de Validacao

- A validacao local padrao do backend neste projeto e:
  - `docker compose --profile test run --rm backend-test`
- Se a entrega alterar fluxo frontend sem adicionar runner novo, o Codex ainda deve validar o comportamento minimo afetado e reportar de forma objetiva o que foi ou nao coberto automaticamente.
- Se a entrega alterar scripts ou pipeline, o Codex deve validar a sintaxe/estrutura desses arquivos alem da suite backend.
- Se alguma validacao obrigatoria estiver bloqueada por ambiente, o Codex deve explicar o bloqueio real com evidencia e nao fingir sucesso.

## Regras para Commit e PR

O Codex so pode commitar e abrir PR depois de:
- DoD cumprido;
- valor prometido pela entrega efetivamente refletido no resultado final do PR;
- arquivos de contexto/processo atualizados quando necessario;
- suite completa verde;
- higiene final concluida.

Se qualquer um desses pontos falhar, o trabalho ainda nao esta finalizado.

### Regra de branch por interacao

- Nova interacao com novo objetivo ou novo PR deve, por padrao, comecar em **branch nova**.
- O Codex so deve reutilizar a branch atual quando estiver claramente continuando o **mesmo PR ainda aberto**.
- Se um contexto de automacao explicitar que a branch e o PR ja existem, o Codex deve reutiliza-los exatamente como informado e nao criar paralelos.
- Se o PR anterior da branch ja tiver sido mergeado ou fechado, o Codex nao deve tratar a branch local como continuacao automatica de trabalho.
- Se a branch remota ja tiver sido apagada apos merge, o Codex deve assumir que o ciclo anterior terminou e criar uma branch nova para a nova entrega.
- Branch mergeada e removida no remoto deve, em regra, ser removida localmente tambem depois de trocar para a base correta e sincronizar o repositorio.

Antes de abrir um PR, o Codex deve verificar explicitamente:
- qual e a branch atual;
- se a branch atual existe no remoto;
- se ja existe PR aberto para essa branch;
- se houve PR anterior da mesma branch ja fechado ou mergeado.

Se um PR anterior tiver sido mergeado e a branch remota tiver sido apagada, o Codex nao deve assumir que o PR antigo pode ser reaproveitado ou reaberto. Ele deve primeiro confirmar o estado atual da branch/remoto e, por padrao, criar uma branch nova para a nova interacao em vez de republicar automaticamente a branch anterior.

### Texto obrigatorio do PR

O texto do PR deve incluir um relatorio final objetivo da entrega, com no minimo:
- resumo do que foi feito;
- arquivos alterados;
- validacao explicita do DoD;
- resultado da suite;
- commit realizado.
