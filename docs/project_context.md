# Project Context: vendor-management

## Papel deste arquivo

`docs/project_context.md` e a fonte de verdade viva do projeto. Ele registra o contexto do produto, o estado atual do sistema, as decisoes ja fechadas, a operacao atual, as limitacoes reais e o roadmap vigente do produto.

Arquivos complementares:
- `docs/pm_workflow.md`: regras da LLM que atua como PM/guia.
- `docs/codex_workflow.md`: regras do Codex como executor tecnico.

Ordem de leitura recomendada:
- PM: ler `docs/project_context.md` e depois `docs/pm_workflow.md`.
- Codex: ler `docs/project_context.md` e depois `docs/codex_workflow.md`.
- Essas leituras devem acontecer antes de qualquer analise, planejamento, implementacao, validacao, commit ou PR ligado ao projeto.

## 1. Visao Geral do Projeto

- **Nome:** `vendor-management`
- **Objetivo principal:** entregar um Vendor Management System (VMS) para Construction & Real Estate, com autenticacao por papeis, cadastro de vendors, gestao de documentos e acompanhamento de compliance.
- **Contexto de uso:** aplicacao full stack para operacao interna de vendors e documentos, com backend API protegido, frontend web e banco relacional.
- **Principio do MVP:** priorizar um fluxo funcional, testavel e auditavel antes de automacoes mais amplas como notificacoes e deploy.
- **Premissas fixas ja tomadas:**
  - O backend e a fonte de verdade para autenticacao, vendors e documentos.
  - Auth usa JWT com papeis `admin` e `vendor`.
  - O frontend deve consumir a API do backend e refletir o estado real dos endpoints existentes.
  - Compliance do vendor depende do estado e validade dos documentos, mas essa logica ainda nao esta completa.
  - O ambiente local principal usa Docker Compose.
  - `backend/.env` configura a aplicacao; `.env` na raiz, quando existir, e reservado para scripts locais do framework.
  - As proximas iteracoes devem buscar o menor incremento seguro que entregue valor funcional visivel, e nao apenas preparacao estrutural.

## 2. Stack e Infraestrutura

- **Backend:** Node.js 18, Express.js, Knex, pg, bcrypt, JWT e UUID.
- **Frontend:** React 19, Vite, React Router, React Hook Form, Yup e Axios.
- **Banco:** PostgreSQL 15 em Docker.
- **Testes backend:** Jest + Supertest, executados pelo servico `backend-test`.
- **Testes frontend:** existe um teste isolado em `frontend/src/__tests__/Login.test.jsx`, mas ainda nao ha runner configurado no `package.json` do frontend nem pipeline frontend consolidado.
- **Ambiente local validado:**
  - SO de referencia validado: Ubuntu/Linux.
  - `docker compose up --build -d` sobe `postgres`, `backend-dev` e `frontend`.
  - `docker compose --profile test run --rm backend-test` executa a suite backend.
  - Portas locais:
    - frontend: `http://localhost:5173`
    - backend: `http://localhost:3000`
    - banco: `localhost:5432`
- **Servicos Compose atuais:**
  - `postgres`: banco de desenvolvimento e teste.
  - `backend-dev`: API Express em hot reload.
  - `backend-test`: suite de testes backend em profile `test`.
  - `frontend`: app React/Vite em hot reload.
- **Fluxo assistido por IA do projeto:**
  - `docs/project_context.md`, `docs/pm_workflow.md` e `docs/codex_workflow.md` definem memoria e processo.
  - `INCREMENTS.md` e a fila ordenada de incrementos.
  - `scripts/check_setup.sh` valida o ambiente local do pipeline.
  - `scripts/gen_prompt.sh`, `scripts/review_pr.sh` e `scripts/merge_pr.sh` cobrem as etapas isoladas do ciclo PM -> Codex -> review -> merge.
  - `scripts/run_increment.sh` e o orquestrador de ponta a ponta que usa Gemini como PM/revisor e o CLI do Codex como executor tecnico nao interativo.

## 3. Estado Atual do Sistema

### Implementado hoje

- Estrutura full stack com `backend/` e `frontend/`.
- Backend Express com endpoint saudavel `GET /api/hello`.
- Integracao com PostgreSQL via Knex.
- Migrations existentes para:
  - `users`
  - `vendors`
  - `documents`
- Auth backend implementada com:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - middleware JWT por bearer token
- Endpoints protegidos de vendors existentes:
  - `GET /api/vendors`
  - `GET /api/vendors/:id`
- Frontend com:
  - home page basica
  - login page com React Hook Form + Yup
  - dashboard protegido
  - `AuthContext` com login e logout basicos
- Testes backend existentes:
  - conectividade com banco
  - fluxo basico de auth
- Seed de teste existente em `backend/db/seeds/test/01-users.js`.
- Ambiente local validado com Docker Compose, migrations e suite backend verde.

### Parcialmente implementado ou incompleto

- Fluxo de autenticacao frontend nao esta fechado:
  - o token e salvo no `localStorage`, mas nao ha bootstrap robusto de sessao ao recarregar a aplicacao;
  - o usuario autenticado nao e reconstruido a partir de `/api/auth/me`;
  - o dashboard atual e apenas placeholder.
- Home page faz chamada ao backend, mas o estado carregado nao e efetivamente exposto na UI.
- O frontend possui um teste isolado, mas ainda nao existe comando oficial de testes frontend.
- `vendors` no backend so cobre leitura; CRUD completo nao existe.

### Ainda nao implementado

- CRUD completo de vendors com validacoes e testes.
- API de documentos com upload, download, versionamento e expiracao.
- Calculo real de compliance baseado em documentos.
- UI de gestao de vendors.
- UI de documentos e compliance.
- Notificacoes por e-mail e agendamento.
- Pipeline completa para frontend, integracao e E2E.
- Deploy e CI/CD alem da validacao backend de PR.

## 4. Decisoes de Dominio / Negocio Ja Fechadas

### Auth e papeis

- Os papeis validos de usuario sao `admin` e `vendor`.
- O backend retorna JWT no registro e no login.
- Rotas protegidas usam header `Authorization: Bearer <token>`.
- `GET /api/auth/me` e a referencia para obter o usuario autenticado no backend.

### Vendors

- A tabela `vendors` existe e usa UUID como chave primaria.
- Cada vendor tem pelo menos:
  - `id`
  - `name`
  - `contact_email`
  - `status`
- Os estados validos de compliance no schema atual sao `Compliant` e `Non-Compliant`.

### Documents

- A tabela `documents` existe e usa UUID como chave primaria.
- Cada documento tem pelo menos:
  - `id`
  - `vendor_id`
  - `type`
  - `file_url`
  - `uploaded_at`
  - `expires_at`
- A logica de documentos e compliance ainda nao esta implementada no nivel funcional do produto, apesar do schema existir.

### Dados e ambiente

- Nao existe seed de desenvolvimento no repositorio.
- Seed automatica existe apenas para o ambiente de teste.
- O projeto usa `backend/.env` para variaveis do backend local.
- Os scripts do framework usam `.env` na raiz para `GEMINI_KEY` e futuras configuracoes locais do pipeline.

## 5. Operacao Atual do Projeto

### Operacao da aplicacao

- Subida local:
  - `docker compose up --build -d`
- Inicializacao do banco:
  - `./init-db.sh`
- Suite backend local:
  - `docker compose --profile test run --rm backend-test`

### Operacao assistida por IA

- O desenvolvedor define o proximo incremento em `INCREMENTS.md`.
- `scripts/check_setup.sh` verifica pre-requisitos locais como `gh`, `codex`, Docker, Git e `GEMINI_KEY`.
- `scripts/gen_prompt.sh` gera o prompt do Codex a partir do incremento pendente, salva `prompts/next_prompt.md` e arquiva uma copia vinculada ao `INC-XXX`.
- `scripts/run_increment.sh` pode executar o ciclo automatizado: gerar prompt, criar/reusar branch, chamar o Codex em batch, abrir/atualizar PR, aguardar checks obrigatorios, pedir review ao Gemini, reenviar correcao ao Codex se necessario e mergear quando aprovado.
- Se o Gemini bater limite diario de requests, `scripts/run_increment.sh` agenda retomada automatica via `scripts/resume_pending.sh` e `crontab`.
- `scripts/review_pr.sh` tambem pode ser usado de forma isolada para revisar o PR contra o objetivo, fora de escopo e DoD usando o prompt arquivado do incremento.
- `scripts/merge_pr.sh` tambem pode ser usado de forma isolada para fazer squash merge em `develop` e marcar o incremento como concluido via GitHub API.

## 6. Riscos e Limitacoes Conhecidas

- O frontend ainda nao possui fluxo de sessao realmente persistente e confiavel.
- A suite automatizada cobre apenas backend e ainda nao cobre os principais fluxos frontend.
- Nao existe seed de desenvolvimento, entao smoke tests manuais normalmente exigem criar usuarios ou dados via API.
- A camada de vendors esta incompleta no backend e ausente no frontend.
- A camada de documentos ainda existe apenas no schema, nao no fluxo funcional.
- A Action de PR backend sera a primeira camada de CI deste repositorio; ainda nao existe pipeline equivalente para frontend.
- Os scripts do framework agora sao shell scripts para uso direto em terminais bash, com dependencia de `gh`, `curl`, `python3`, Docker e CLI do Codex.
- A automacao ponta a ponta depende de o CLI do Codex estar disponivel localmente e autenticado para execucao nao interativa.
- A automacao ponta a ponta tambem depende de `crontab` quando a retomada automatica por limite diario do Gemini estiver habilitada.
- `backend/.env` e `.env` na raiz tem papeis diferentes e nao devem ser confundidos.
- O fluxo de review e merge depende de o titulo do PR conter `INC-XXX` e de o trabalho seguir um incremento por vez.

## 7. Roadmap do Produto

### Como ler o roadmap

- Este roadmap e leve e serve para orientar o ciclo PM -> Codex -> review -> merge sem transformar o processo em burocracia.
- `Tema ativo` indica a frente principal que deve guiar o proximo refinamento e os proximos prompts.
- `Frentes de evolucao` organizam o produto em blocos funcionais maiores do que um incremento isolado.
- `INCREMENTS.md` continua sendo a fila operacional de fatias prontas para execucao.
- O PM nao deve mandar o Codex implementar diretamente uma frente ampla ou um tema ainda ambiguo; o handoff deve acontecer no nivel de incremento executavel.

### Frentes de evolucao

1. **Acesso e sessao do usuario**
   - Consolidar autenticacao funcional no frontend e garantir a primeira experiencia ponta a ponta do usuario autenticado.
2. **Gestao operacional de vendors**
   - Completar a camada de vendors no backend e entregar a primeira UI operacional correspondente.
3. **Documentos e compliance**
   - Transformar o schema existente em fluxo funcional de documentos, expiracao e status de compliance.
4. **Operacao assistida e robustez**
   - Endurecer validacoes, automacoes, testes mais amplos, notificacoes e pipeline de entrega.

### Tema ativo do roadmap

- **Tema ativo:** Acesso e sessao do usuario
- **Objetivo do tema:** fechar a primeira jornada funcional real do frontend autenticado antes de ampliar escopo para vendors e documentos.
- **Motivo da prioridade atual:**
  - a base de backend e auth ja existe;
  - o frontend ja possui login, `AuthContext` e dashboard protegido, mas a sessao ainda nao e robusta;
  - sem essa base, os proximos incrementos de vendors e documentos ficam mais caros de validar ponta a ponta.

### Estrutura de refinamento do tema ativo

- **Epico 1:** Persistencia e bootstrap de sessao no frontend
  - Reconstruir sessao com base no token existente e em `GET /api/auth/me`.
- **Epico 2:** Navegacao autenticada minima e estado confiavel
  - Garantir que login, logout, protecao de rota e dashboard reflitam o estado real da sessao.
- **Primeira fatia pronta para execucao recomendada:**
  - Fechar o fluxo de autenticacao frontend com persistencia de sessao e bootstrap do usuario autenticado.

### Backlog estrategico ordenado

1. Fechar autenticacao frontend com sessao persistente e bootstrap do usuario.
2. Completar CRUD de vendors no backend com testes.
3. Entregar UI basica de vendors integrada a API.
4. Implementar API de documentos e atualizacao de compliance.
5. Entregar UI de documentos e status de compliance.
6. Adicionar notificacoes e agendamento.
7. Consolidar testes frontend/integracao e endurecer validacoes.
8. Preparar deploy e CI/CD mais ampla.

### Regra de governanca do roadmap

- `docs/project_context.md` deve registrar tema ativo, frentes e ordem estrategica.
- `INCREMENTS.md` deve refletir apenas incrementos executaveis ou quase executaveis.
- Se um item do backlog ainda estiver amplo demais para virar prompt tecnico, ele deve ser refinado antes do handoff ao Codex.
- Se o tema ativo mudar, `docs/project_context.md` deve ser atualizado no mesmo PR que formalizar essa mudanca.

### Proximo passo recomendado

- **Fechar o fluxo de autenticacao frontend com persistencia de sessao e bootstrap do usuario autenticado.**
- Essa ainda e a melhor proxima entrega porque fecha a jornada basica do usuario e cria base confiavel para os incrementos de vendors e documentos.
