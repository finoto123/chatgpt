# Migração Selma Bordados para DeskcommCRM

## Escopo

Esta aplicação é a nova base da Selma Bordados. O DeskcommCRM fornece o núcleo de autenticação, organizações, RBAC, CRM, Inbox, WhatsApp, IA, RAG, automações, MCP, auditoria e eventos. O sistema anterior da Selma permanece como fonte legada, somente para consulta e para portar os domínios específicos de confecção.

A migração acontece em paralelo. Não há cutover autorizado, e nenhuma etapa deste trabalho deve alterar o banco ou a aplicação legada em produção.

## Fontes registradas

| Fonte                 | Caminho ou URL                                        | Branch | Commit                                     |
| --------------------- | ----------------------------------------------------- | ------ | ------------------------------------------ |
| DeskcommCRM oficial   | https://github.com/melgarafael/DeskcommCRM            | `main` | `1c9a46a180835cd21bcd74a732fba085df8f3e13` |
| Selma Bordados legacy | `C:\Users\gabri\Downloads\Nova pasta\selmabordados-1` | `main` | `c2c42ab8e81713e99b3974d6f489b5c3b3fac79c` |

O código base foi criado a partir do commit acima do DeskcommCRM. A licença MIT original foi preservada em `LICENSE` e copiada para `THIRD_PARTY_LICENSES/DeskcommCRM-MIT.txt`.

## Salvaguardas da aplicação legada

- Backup local do código: `C:\Users\gabri\Downloads\Nova pasta\backup\selmabordados-before-deskcomm-20260909`.
- O backup inclui o histórico Git e as alterações locais ainda não commitadas.
- Dump completo do banco legado: **PENDENTE**. A service role disponível não fornece uma conexão PostgreSQL apropriada para `pg_dump`.
- Backup dos objetos do Supabase Storage legado: **PENDENTE**.
- Nenhum reset, clean, restore, commit, push ou alteração de produção foi executado.

## Regras de banco

- O `supabase/baseline.sql` do DeskcommCRM será aplicado somente em um projeto Supabase novo para staging.
- O banco legado da Selma não receberá o baseline do DeskcommCRM.
- O staging precisa habilitar pelo menos `vector`, `citext` e `pg_trgm` antes do baseline, além das extensões que a versão registrada exigir.
- Toda evolução posterior de schema seguirá migration versionada, apêndice idempotente no baseline e registro no `supabase/migrations/MANIFEST.md`.
- Todos os dados Selma migrados pertencerão à organização `Selma Bordados`.

## Ambiente local

- Versão exigida: Node.js 22 ou superior.
- Gerenciador fixado pelo projeto: pnpm 9.15.9.
- O computador possui Node.js 24 e pnpm 11 no PATH; existe também Node.js 22.23.2 no workspace legado. A validação desta aplicação deve usar Node 22.23.2 e pnpm 9.15.9.
- Docker e Bash não estão disponíveis no ambiente Windows atual. Por isso, `test:db` e o E2E completo dependente do Supabase local ainda exigem infraestrutura compatível.

## Estado das fases

| Fase                     | Estado                    | Evidência ou pendência                                                                                                                                                            |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — backup               | Parcial                   | Código e Git preservados; dump do banco e Storage pendentes                                                                                                                       |
| 1 — clonar DeskcommCRM   | Concluída                 | URL, branch, SHA e licença registrados                                                                                                                                            |
| 2 — estudar DeskcommCRM  | Concluída                 | Doutrina, arquitetura, setup, white label, segurança e diretórios principais analisados                                                                                           |
| 3 — criar nova aplicação | Concluída                 | `selmabordados-next` criado com a estrutura nativa                                                                                                                                |
| 4 — banco novo           | Pendente                  | Criar `selmabordados-next-staging`; nunca reutilizar o banco legacy. A abertura do painel Supabase foi bloqueada por uma preferência salva de permissão do navegador desta sessão |
| 5 — Deskcomm puro        | Parcial, verde localmente | Instalação concluída; typecheck, lint, gates, unit tests e build passaram. DB tests e E2E aguardam o novo staging ou Docker                                                       |
| 6 — white label          | Aguardando infraestrutura | Começa depois do baseline e dos testes de banco no staging novo                                                                                                                   |
| 7 — organização/tenant   | Aguardando staging        | Criar `Selma Bordados` sem remover a multi-tenancy                                                                                                                                |
| 8 — inventário legacy    | Concluída em código       | Matriz criada em `docs/selma-feature-matrix.md`; dados e Storage ainda exigem dump/inventário autenticados                                                                        |
| 9 em diante              | Planejada, não iniciada   | Depende do staging, da confirmação dos dados reais e do restante da solicitação truncada na Fase 24                                                                               |

## Critério antes da customização

O Deskcomm puro passou localmente em:

- `pnpm typecheck`;
- `pnpm lint`, com zero erros e 344 avisos já presentes no upstream;
- `pnpm lint:channels`, com 62 arquivos de dívida conhecida e nenhuma violação nova;
- `pnpm lint:role-rank`;
- `pnpm test:unit`, com 742 arquivos e 7.963 testes aprovados, além de 1 falha esperada pelo próprio teste;
- `pnpm build`, com todas as rotas compiladas.

Cinco testes receberam apenas ajustes de portabilidade do harness para caminhos do Windows; nenhuma regra de aplicação foi alterada. `pnpm test:db` e E2E permanecem pendentes porque Docker não está instalado e o Supabase novo ainda não foi criado. Essas pendências são de infraestrutura e não foram registradas como aprovações inexistentes.

## Estratégia de migração

1. Manter Auth, organizações, memberships, RBAC, CRM, Inbox, WhatsApp, IA, RAG, automações, MCP, Realtime e `event_log` do DeskcommCRM como fontes únicas.
2. Migrar dados comerciais compatíveis por transformações explícitas, preservando o identificador legado.
3. Reimplementar no design system e nas convenções do DeskcommCRM somente os módulos específicos de confecção.
4. Usar tools autorizadas para a IA; o agente não consulta o banco diretamente.
5. Emitir eventos e processar efeitos externos por workers, sem HTTP em triggers PostgreSQL.
6. Adiar qualquer cutover até concluir migração de dados, testes de isolamento, QA visual e plano de rollback.

O inventário de funcionalidades e as decisões de destino estão em `docs/selma-feature-matrix.md`. A principal decisão é manter `orders` para os pedidos externos suportados pelo DeskcommCRM e criar um domínio tenant-aware específico para os pedidos fabris da Selma, integrado ao CRM nativo e ao `event_log`.

O procedimento reproduzível para criar e validar o banco novo está em `docs/staging-bootstrap.md`. Ele inclui uma trava explícita contra o project ref legado, a ordem correta das extensões e do baseline, a reaplicação idempotente e consultas mínimas de RLS/privilégios.

O pedido fornecido para esta execução termina durante a Fase 24, após a palavra `Produ`. O restante dessa fase e eventuais fases posteriores precisam ser recuperados antes de fechar o plano completo de cutover.
