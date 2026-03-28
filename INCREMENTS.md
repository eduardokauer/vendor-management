# INCREMENTS

- [x] **INC-001** Fechar fluxo de autenticacao frontend com persistencia de sessao
  - Reconstruir a sessao no frontend a partir do token salvo, carregar o usuario autenticado com `GET /api/auth/me` e proteger a navegacao com base no estado real da sessao.
  - Ajustar o fluxo de login/logout para que a experiencia minima autenticada fique consistente apos refresh, expiracao de token e inicializacao da aplicacao.
  - Fora de escopo: implementar cadastro publico, gestao de vendors, documentos, redesign visual amplo ou novas regras de negocio de auth no backend.

- [x] **INC-002** Completar CRUD de vendors no backend com testes
  - Implementar criacao, atualizacao e remocao de vendors com validacoes basicas coerentes com o schema atual e cobrindo os principais cenarios de erro.
  - Expandir a suite backend para cobrir o fluxo protegido de vendors alem dos endpoints de leitura ja existentes.
  - Fora de escopo: pagina de vendors no frontend, documentos, paginacao avancada, busca complexa ou compliance automatica.

- [x] **INC-003** Entregar UI basica de gestao de vendors integrada a API
  - Criar fluxo minimo no frontend para listar, criar, editar e remover vendors usando os endpoints reais do backend.
  - Integrar a navegacao autenticada para expor essa area apos login, mantendo o dashboard como entrada minima funcional.
  - Fora de escopo: upload de documentos, compliance detalhada, filtros avancados, redesign amplo ou notificacoes.

- [x] **INC-004** Implementar API de documentos com upload local e compliance basica
  - Criar endpoints backend para upload e download de documentos com armazenamento local para desenvolvimento e persistencia do metadata no banco.
  - Atualizar a logica backend para refletir status de compliance do vendor com base na presenca e validade dos documentos suportados pelo MVP.
  - Fora de escopo: integracao com storage externo, versionamento sofisticado, UI completa de documentos ou notificacoes por e-mail.

- [x] **INC-005** Entregar UI de documentos e status de compliance por vendor
  - Integrar o frontend com a API de documentos para permitir upload minimo, listagem e visualizacao de status de compliance.
  - Expor o status do vendor de forma clara na experiencia autenticada e no fluxo de gestao de vendors.
  - Fora de escopo: drag and drop avancado, historico de versoes complexo, notificacoes e dashboard analitico amplo.

- [x] **INC-006** Implementar notificacoes por e-mail e agendamento
  - Adicionar backend para lembretes de expiracao e resumo periodico, com configuracao por variaveis de ambiente e scheduler localmente testavel.
  - Documentar como simular datas de expiracao e validar o fluxo de envio sem depender de credenciais reais de producao.
  - Fora de escopo: provedores externos de producao, telas administrativas de notificacoes ou automacao de deploy.

- [x] **INC-007** Consolidar testes automatizados e endurecer validacoes
  - Estruturar o runner de testes do frontend e ampliar a cobertura dos fluxos principais ja implementados no produto.
  - Endurecer validacoes e cenarios de erro mais criticos no backend, incluindo auth, vendors e documentos.
  - Fora de escopo: E2E pesada, redesign de arquitetura, novas features de produto ou automacoes de release.

- [ ] **INC-008** Preparar deploy e CI/CD alem do teste de PR
  - Consolidar os artefatos minimos para deploy e evoluir a automacao alem da Action de testes de PR.
  - Documentar o fluxo de promocao entre `develop` e `main`, variaveis necessarias e passos de publicacao.
  - Fora de escopo: novas features de dominio, refactors amplos, migracao de stack ou observabilidade avancada.
