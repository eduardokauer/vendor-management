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
- **Testes frontend:** existe comando oficial `npm test` no frontend com Vitest + jsdom cobrindo login e sessao em `frontend/src/__tests__/Login.test.jsx`, mas ainda nao ha pipeline frontend consolidado.
- **Ambiente local validado:**
  - SO de referencia validado: Ubuntu/Linux.
  - `docker compose up --build -d` sobe `postgres`, `backend-dev` e `frontend`.
  - `docker compose --profile test run --rm backend-test` executa a suite backend usando o codigo atual montado de `./backend`, evitando validacao sobre imagem defasada.
  - Portas locais:
    - frontend: `http://localhost:5173`
    - backend: `http://localhost:3000`
    - banco: `localhost:5432`
- **Servicos Compose atuais:**
  - `postgres`: banco de desenvolvimento e teste.
  - `backend-dev`: API Express em hot reload.
  - `backend-test`: suite de testes backend em profile `test`, montando `./backend` para refletir o estado atual do workspace durante a validacao.
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
  - autorizacao por papel para rotas que exigem `admin`
- Endpoints de vendors existentes:
  - `GET /api/vendors`
  - `GET /api/vendors/:id`
  - `POST /api/vendors`
  - `PUT /api/vendors/:id`
  - `DELETE /api/vendors/:id`
- Endpoints minimos de documentos existentes:
  - `POST /api/documents/upload/:vendorId`
  - `GET /api/vendors/:vendorId/documents`
  - `POST /api/vendors/:vendorId/documents`
  - `GET /api/documents/:documentId/download`
  - `POST /api/vendors/:id/check-compliance`
- CRUD de vendors no backend concluido com:
  - validacoes basicas de `name`, `contact_email` e `status`
  - tratamento de erro para 400, 401, 403 e 404
  - acesso restrito a usuarios com papel `admin`
- Fluxo minimo de documentos no backend concluido com:
  - upload multipart com armazenamento local em `backend/uploads/documents`
  - persistencia do metadata no banco em `documents`
  - download por `documentId`
  - atualizacao basica do status de compliance do vendor com base em documentos obrigatorios nao expirados
  - endpoint manual para recalcular compliance sob demanda por vendor
- Frontend com:
  - home page basica
  - login page com React Hook Form + Yup
  - dashboard protegido
  - `AuthContext` com persistencia de token no `localStorage`, bootstrap de sessao via `GET /api/auth/me`, protecao de rota e logout limpando a sessao
  - fluxo admin de vendors com CRUD basico no frontend
  - pagina autenticada de documentos por vendor com upload minimo, listagem, download e refresh manual de compliance
- Testes backend existentes:
  - conectividade com banco
  - fluxo basico de auth
  - suite de integracao para CRUD de vendors cobrindo sucesso e erros principais
- Teste frontend minimo existente:
  - login com persistencia de token
  - restauracao de sessao em rota protegida
  - limpeza de token invalido com redirecionamento para login
  - gestao de vendors no frontend
  - fluxo de documentos/compliance por vendor no frontend
- Seed de teste existente em `backend/db/seeds/test/01-users.js`.
- Ambiente local validado com Docker Compose, migrations e suite backend verde.

### Parcialmente implementado ou incompleto

- Fluxo de autenticacao frontend:
  - estado: Fechado para login, persistencia do token, bootstrap via `/api/auth/me`, protecao de rota, logout e dashboard autenticado com resumo operacional basico;
  - o dashboard ainda nao oferece analiticos amplos, filtros ou automacoes operacionais.
- Home page faz chamada ao backend, mas o estado carregado nao e efetivamente exposto na UI.
- O frontend agora possui comando oficial de testes, mas a cobertura ainda e enxuta mesmo apos incluir auth, vendors e documentos.
- O frontend ja cobre a operacao minima de vendors e documentos para `admin`, mas ainda sem refinamentos de UX como filtros, historico ou dashboard analitico.

### Ainda nao implementado

- Versionamento sofisticado de documentos.
- Regras de compliance mais avancadas do que o baseline atual por tipos obrigatorios e validade.
- Notificacoes por e-mail e agendamento.
- Pipeline completa para frontend, integracao e E2E.
- Deploy e CI/CD alem da validacao backend de PR.

## 4. Decisoes de Dominio / Negocio Ja Fechadas

### Auth e papeis

- Os papeis validos de usuario sao `admin` e `vendor`.
- O backend retorna JWT no registro e no login.
- Rotas protegidas usam header `Authorization: Bearer <token>`.
- `GET /api/auth/me` e a referencia para obter o usuario autenticado no backend.
- O CRUD de vendors deve permanecer restrito a usuarios com papel `admin`.

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
- O backend agora suporta upload local, listagem por vendor e download por `documentId`.
- O backend tambem expoe um endpoint de acionamento manual da compliance por vendor em `POST /api/vendors/:id/check-compliance`.
- O upload atual usa armazenamento local em `backend/uploads/documents`, pensado para desenvolvimento local.
- A regra minima de compliance atual considera o vendor `Compliant` apenas quando existem documentos nao expirados para todos os tipos obrigatorios.
- Os tipos obrigatorios atuais podem ser configurados por `REQUIRED_DOCUMENT_TYPES`; sem override, o baseline do projeto e `insurance,license`.
- Versionamento de documentos, storage externo e regras avancadas de compliance continuam fora do baseline atual.

### Dados e ambiente

- Nao existe seed de desenvolvimento no repositorio.
- Seed automatica existe apenas para o ambiente de teste.
- O projeto usa `backend/.env` para variaveis do backend local.
- `REQUIRED_DOCUMENT_TYPES` e opcional no backend e permite sobrescrever os tipos obrigatorios usados na compliance basica.
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
- `scripts/run_increment.sh` pode executar o ciclo automatizado: gerar prompt, criar/reusar branch, chamar o Codex em batch para editar o codigo, rodar validacoes no host, commitar/subir branch, abrir/atualizar PR, aguardar checks obrigatorios, pedir review ao Gemini, reenviar correcao ao Codex se necessario e mergear quando aprovado.
- Se o Gemini bater limite diario de requests, `scripts/run_increment.sh` agenda retomada automatica via `scripts/resume_pending.sh` e `crontab`.
- `scripts/review_pr.sh` tambem pode ser usado de forma isolada para revisar o PR contra o objetivo, fora de escopo e DoD usando o prompt arquivado do incremento.
- `scripts/merge_pr.sh` tambem pode ser usado de forma isolada para fazer squash merge em `develop` e marcar o incremento como concluido via GitHub API.
- O orquestrador salva um log legivel por humano em `prompts/generated/INC-XXX-orchestrator.log` e os eventos JSON crus do Codex em arquivos separados para auditoria.

## 6. Riscos e Limitacoes Conhecidas

- A jornada inicial de autenticacao frontend foi fechada e a cobertura automatizada agora inclui auth, vendors e documentos, mas ainda e pequena para o escopo total do produto.
- Nao existe seed de desenvolvimento, entao smoke tests manuais normalmente exigem criar usuarios ou dados via API.
- A camada de vendors e documentos agora existe no frontend para `admin`, mas ainda sem refinamentos de UX, filtros ou experiencia mobile mais profunda.
- A camada de documentos segue dependente de storage local no backend e sem versionamento.
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

- **Tema ativo:** Operacao assistida e robustez
- **Objetivo do tema:** endurecer o MVP ja funcional com notificacoes, cobertura automatizada mais ampla e automacoes operacionais.
- **Motivo da prioridade atual:**
  - a jornada de acesso e sessao do usuario foi fechada com bootstrap via `/api/auth/me`;
  - a camada autenticada de vendors e documentos/compliance ja existe de ponta a ponta para `admin`;
  - o baseline visivel prometido pelo MVP agora esta entregue;
  - o principal gap restante passa a ser robustez operacional, notificacoes e testes mais amplos.

### Estrutura de refinamento do tema ativo

- **Epico 1:** Notificacoes e agendamento
  - Adicionar lembretes e rotinas operacionais a partir das datas de expiracao ja suportadas pelo backend.
- **Epico 2:** Robustez de testes e validacoes
  - Consolidar cobertura frontend/integracao e endurecer os principais cenarios de erro.
- **Epico 3:** Preparacao de entrega
  - Evoluir CI/CD e fluxo de publicacao alem do baseline atual de PR.
- **Primeira fatia pronta para execucao recomendada:**
  - Iniciar a camada de notificacoes e agendamento em cima do baseline atual de compliance.

### Backlog estrategico ordenado

1. Adicionar notificacoes e agendamento.
2. Consolidar testes frontend/integracao e endurecer validacoes.
3. Preparar deploy e CI/CD mais ampla.

### Regra de governanca do roadmap

- `docs/project_context.md` deve registrar tema ativo, frentes e ordem estrategica.
- `INCREMENTS.md` deve refletir apenas incrementos executaveis ou quase executaveis.
- Se um item do backlog ainda estiver amplo demais para virar prompt tecnico, ele deve ser refinado antes do handoff ao Codex.
- Se o tema ativo mudar, `docs/project_context.md` deve ser atualizado no mesmo PR que formalizar essa mudanca.

### Proximo passo recomendado

- **Implementar notificacoes por e-mail e agendamento.**
- Essa passa a ser a melhor proxima entrega porque o fluxo minimo de vendors e documentos/compliance ja existe de ponta a ponta para `admin`, enquanto o proximo ganho funcional real esta nas automacoes de expiracao e resumo operacional.
