# Auditoria Master do Sistema Selma Bordados

Data da auditoria: 11/09/2026
Escopo: `selmabordados-1`, `selmabordados-next` (DeskcommCRM), configuração local e dois projetos Supabase de referência.
Modo: somente leitura no código e nos bancos. Nenhuma migration foi aplicada, nenhum dado foi alterado e nenhuma correção foi implementada.

## 1. Relatório executivo

| Item | Resultado |
| --- | --- |
| Veredito | 🔴 **REPROVADO para a meta “um único sistema completo pronto para produção”** |
| Score geral | **47%** de conformidade evidenciada |
| P0 | **4** |
| P1 | **8** |
| P2 | **7** |
| P3 | **4** |
| Módulos mais maduros | Auth/RBAC Selma, pedidos/financeiro base, CRM Selma, orçamento/proposta, segurança de upload |
| Módulos faltantes no aplicativo único | Inbox real, mensagens, WhatsApp, realtime, filas, assignment, handoff e ponte operacional Deskcomm → Selma |
| Principal risco arquitetural | Dois aplicativos, dois modelos de autenticação/RBAC e dois modelos de CRM permanecem ativos sem uma integração executável |
| Próximo passo | Criar staging isolado e executar a Fase A do `MASTER-FIX-PLAN.md`, começando pela decisão de runtime único e contrato de dados único |

O veredito reprova a **unificação e a prontidão para produção do conjunto**, não afirma que o sistema operacional Selma atualmente em uso esteja indisponível. A produção real não foi alterada nem recebeu testes destrutivos. O banco configurado localmente foi tratado como ambiente de referência, conforme orientação do usuário.

## 2. Convenções e método

Status usados:

- ✅ Implementado e validado
- 🟡 Implementado parcialmente
- 🔴 Não implementado
- ⚠️ Implementado mas com problema
- 🧪 Implementado mas não homologado
- 🗑️ Implementação antiga, duplicada ou não utilizada
- 📋 Planejado, ainda não implementado
- ❓ Não foi possível confirmar

O score não é média simples de quantidade de arquivos. Itens P0, fluxos ponta a ponta, isolamento de dados e integridade têm peso maior. Presença de tabela, comentário, migration ou teste que apenas inspeciona texto não foi considerada homologação.

## 3. Estado Git auditado

### 3.1 Selma principal

| Campo | Valor |
| --- | --- |
| Diretório | `C:\Users\gabri\Downloads\Nova pasta\selmabordados-1` |
| Branch | `main` |
| HEAD | `c2c42ab8e81713e99b3974d6f489b5c3b3fac79c` |
| Último commit | `c2c42ab feat: redesign CRM and stabilize order drafts` |
| Diff rastreado | 42 arquivos; 455 inserções; 514 exclusões |
| Estado | Sujo, com arquivos rastreados modificados e vários arquivos não rastreados |

Alterações rastreadas relevantes: `.gitignore`, `AGENTS.md`, `package.json`, login, layout, dashboard, CRM, produção, compras, pedidos, proposta, auth/RBAC/security, queries, testes e migrations de orçamento. As antigas rotas `src/app/orcamentos/*` aparecem removidas e foram substituídas por `src/app/crm/orcamentos/*` ainda não rastreadas.

Arquivos não rastreados relevantes: documentos de arquitetura/integração, runbook do Lote 8, `src/app/arte`, `src/app/comercial`, `src/app/crm/orcamentos`, `src/app/operacional`, componentes e queries operacionais, bridge, testes e migrations `202609090004` e `202609100001` a `202609100004`.

Ignorados relevantes: `.env.local`, `.next`, `node_modules`. O primeiro comando Git encontrou proteção de “dubious ownership”; a auditoria usou `git -c safe.directory=...` somente no comando, sem alterar configuração global.

### 3.2 DeskcommCRM

| Campo | Valor |
| --- | --- |
| Diretório | `C:\Users\gabri\Downloads\Nova pasta\selmabordados-next` |
| Branch | `main` |
| HEAD | `1c9a46a180835cd21bcd74a732fba085df8f3e13` |
| Último commit | `1c9a46a1 Merge pull request #640 from melgarafael/fix/memoria-historico-encerrado` |
| Diff rastreado | 19 arquivos; 186 inserções; 40 exclusões |
| Estado | Sujo, com alterações de base path, auth, inbox/mídia e testes |

Não rastreados relevantes: rota/teste de auth realtime, `app/preview`, documentos de migration/feature/staging, utilitário e testes de caminho comercial/permissões. Ignorados relevantes: `.env.local`, `.next`, `node_modules`, `tsbuildinfo`.

**Consequência:** nenhum resultado desta auditoria representa um commit reproduzível. Antes de homologar, a árvore precisa ser congelada e identificada por commit.

## 4. Arquitetura real encontrada

```text
                                    ┌─────────────────────────────────────┐
Browser em localhost:3001 ─────────>│ Selma: selmabordados-1              │
                                    │ Next 16 / React 19 / npm            │
                                    │ /login + cookie Supabase padrão     │
                                    │ RBAC profiles/roles/permissions     │
                                    │ Operação + CRM Selma + Orçamentos   │
                                    └──────────────────┬──────────────────┘
                                                       │ cliente Supabase Selma
                                                       v
                                    ┌─────────────────────────────────────┐
                                    │ zask... (referência atual local)     │
                                    │ Selma + objetos CRM antigos/paralelos│
                                    └─────────────────────────────────────┘

Outro processo/repositório ────────>┌─────────────────────────────────────┐
                                    │ Deskcomm: selmabordados-next        │
                                    │ Next 16 / React 19 / pnpm           │
                                    │ basePath opcional /comercial        │
                                    │ cookie sb-deskcomm-auth             │
                                    │ organizations/user_organizations    │
                                    │ 112 páginas + 254 APIs + workers    │
                                    └──────────────────┬──────────────────┘
                                                       │ configuração local atual
                                                       v
                                    ┌─────────────────────────────────────┐
                                    │ zask... (incompatível com Deskcomm)  │
                                    │ falta platform_branding, entre outros│
                                    └─────────────────────────────────────┘

Banco Deskcomm de referência: fzbk... ── schema completo Deskcomm, mas não
montado como domínio interno executável no processo Selma.

DeskcommCommercialBridge ── apenas interface TypeScript; sem adapter, mapping
table, implementação concreta ou chamada no fluxo do Inbox.
```

### 4.1 Respostas explícitas

| Pergunta | Resultado |
| --- | --- |
| Existem dois Next.js? | **Sim** |
| Existem dois clientes Supabase? | **Sim**, conjuntos independentes por aplicação |
| Existem dois sistemas Auth? | **Sim**, sessões/cookies e lógica diferentes |
| Existem dois RBAC? | **Sim**, Selma por roles/permissions; Deskcomm por organizações e ranking de papel |
| Existem dois CRM? | **Sim**, CRM Selma e CRM Deskcomm ativos no código |
| Existem dois bancos? | **Sim**, dois projetos de referência; a produção real não foi fornecida para validação |
| Existem dois pipelines? | **Sim**, `pipelines/pipeline_stages` e `crm_pipelines/crm_stages` |
| Existem dois sistemas de automação? | **Sim**, objetos Selma e motor completo Deskcomm |
| É monorepo? | **Não**; são dois repositórios e dois gerenciadores de pacotes |
| Deskcomm foi incorporado ao Selma? | **Não**. Há rotas de fachada/redirecionamento e um contrato sem implementação |

## 5. A arquitetura aprovada foi respeitada?

A separação conceitual está bem descrita em `docs/ARCHITECTURE-SELMA-DESKCOMM.md`: Selma como principal; Deskcomm apenas para atendimento/conversação; operação fabril preservada. O código operacional não importa módulos Deskcomm nos diretórios auditados. Isso é positivo.

Porém, o estado executável não cumpre a arquitetura:

- `/comercial/app/inbox`, templates, connections, webhooks e várias telas de IA são placeholders com status `integrating`.
- várias rotas comerciais somente redirecionam para o CRM Selma existente;
- a tela de agentes de IA lê tabelas de referência, mas não incorpora o runtime Deskcomm;
- o Deskcomm continua sendo outro Next.js com outro cookie, outro proxy e outro RBAC;
- o `DeskcommCommercialBridge` contém apenas tipos e métodos delegadores;
- não há implementação concreta, tabela de mapping nem fluxo WhatsApp → orçamento/pedido Selma;
- o Deskcomm ainda possui `orders`, que não representa `pedidos` fabris.

Classificação: 🔴 **não implementado como sistema único**.

## 6. Bancos e migrations

### 6.1 Projetos Supabase observados

| Ref | Nome | Região | Uso observado |
| --- | --- | --- | --- |
| `zaskzrplimoudreqodbf` | `selmabordado@gmail.com's Project` | sa-east-1 | Configuração local atual das duas aplicações; contém Selma e schemas CRM paralelos |
| `fzbkzugukvngsbygzgjn` | `Crm` | sa-east-1 | Banco de referência Deskcomm solicitado pelo usuário |

Ambos estavam `ACTIVE_HEALTHY` e Postgres 17.6 durante a leitura. Nenhuma escrita foi feita.

### 6.2 Selma local x remoto

- 20 migrations locais, 51 tabelas declaradas, 110 funções, 3 views, 3 sequences, 136 policies e 27 triggers.
- O remoto `zask...` contém a base Selma e também um CRM/WhatsApp anterior ou paralelo.
- Histórico remoto de migrations: somente `20260911171437 harden_function_search_paths` e `20260911172132 restore_application_rpcs`.
- As 20 migrations locais não aparecem no histórico remoto. O schema parece ter sido aplicado fora do controle normal de migration.
- Existem prefixos locais duplicados (`002` e `202609090001`), aumentando risco de ordem divergente.

Classificação: ⚠️ **schema presente, histórico não confiável e homologação impossível pelo ledger atual**.

### 6.3 Deskcomm local x remoto

- 213 migrations locais, aproximadamente 93 tabelas declaradas, 154 funções, 3 views, 118 policies e 78 triggers detectados no texto.
- O remoto `fzb...` tem o domínio Deskcomm completo, 5 buckets e 475 policies.
- O histórico remoto de migrations retornou **zero entradas**.
- `package.json` ainda define `db:migrate` como `TODO` que apenas imprime texto e retorna sucesso.

Classificação: ⚠️ **schema substancial, mas cadeia de instalação/migration não é auditável nem reproduzível**.

### 6.4 Colisões de modelo

Colisões confirmadas: `contacts`, `automation_rules`, `crm_leads`, `crm_pipelines`, `crm_stages`, `ai_knowledge_versions`. Há colisão semântica crítica entre `Deskcomm.public.orders` e `Selma.public.pedidos`. Os modelos de usuário/tenant também não são equivalentes.

## 7. Segurança Supabase, RLS e performance

### 7.1 Projeto `zask...`

- todas as tabelas `public` listadas estavam com RLS habilitado;
- 109 policies foram identificadas;
- 35 tabelas com RLS não possuíam policy;
- 3 funções `SECURITY DEFINER` eram executáveis por `anon`: RPCs públicas de proposta. O uso pode ser intencional, mas exige teste de token, expiração, replay e rate limit;
- 44 funções `SECURITY DEFINER` executáveis por `authenticated` receberam alerta;
- proteção contra senhas vazadas estava desativada;
- 4 policies de leitura CRM usavam condição ampla equivalente a `true` para authenticated;
- performance: 76 FKs sem índice, 15 casos de `auth` não inicializado no RLS, 82 índices não usados e 3 índices duplicados.

### 7.2 Projeto `fzb...`

- todas as tabelas `public` listadas estavam com RLS habilitado;
- 475 policies;
- 13 tabelas com RLS sem policy;
- 3 funções com `search_path` mutável;
- 3 extensões instaladas em `public`;
- 29 funções `SECURITY DEFINER` executáveis por authenticated;
- proteção contra senhas vazadas desativada;
- `ai_models` e `ai_pricing` têm leitura pública ampla;
- performance: 175 FKs sem índice, 11 casos de `auth` não inicializado, 5 tabelas sem PK, 176 índices não usados, 147 conjuntos de policies permissivas múltiplas e 1 índice duplicado.

Os números são alertas para triagem, não autorização para alteração. Referências: Supabase Database Linter para [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [FK sem índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [auth RLS initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [policies permissivas múltiplas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) e [search path mutável](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

## 8. Resultados de comandos executados

### 8.1 Selma

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `npm run lint` | 0 | Sem erro |
| `npx tsc --noEmit` | 0 | Sem erro |
| `npm test` | 0 | 100 testes passaram |
| `npm audit --omit=dev --json` | 0 | 0 vulnerabilidades em dependências de produção |
| `npm run build` | 0 | Build Next concluído; 41 páginas e 3 APIs |
| GET anônimo `/dashboard` | HTTP 307 | Redirecionou para `/login?next=%2Fdashboard` |
| GET anônimo nas 3 APIs de pedido | HTTP 401 | Proteção real confirmada sem sessão |

Limite: a suíte `npm test` é majoritariamente unitária/estática e muitos testes de migration procuram padrões no texto SQL. Os 8 arquivos SQL não são executados pelo script. Não há E2E Selma.

### 8.2 Deskcomm

| Comando | Exit | Resultado |
| --- | ---: | --- |
| `pnpm typecheck` | 0 | Sem erro |
| `pnpm lint` | 0 | 344 warnings, 0 errors; 9 corrigíveis automaticamente |
| `pnpm test:unit` | 1 | 15 arquivos falharam; 731 passaram. 28 testes falharam; 7.951 passaram; 1 expected fail |
| `pnpm audit --prod --json` | 1 | 3 vulnerabilidades moderadas em `hono@4.13.1`, transitiva de MCP SDK; correção indicada `>=4.13.5` |
| `pnpm build` em sandbox | 1 | Falhou ao buscar Google Fonts por restrição de rede |
| `pnpm build` com rede liberada | 0 | Build concluído; 112 páginas e 254 APIs |
| `pnpm test:db` | não executado | Bash inacessível e Docker daemon indisponível; script cria banco efêmero e executa 100 invariantes |
| `pnpm test:e2e` / journeys | não executado | Sem staging isolado/credenciais; os fluxos podem gravar dados |

Falhas unitárias relevantes: contrato de `commercialPath`, leitura duplicada de body, URLs de mídia/knowledge esperando `/api` mas recebendo `/comercial/api`, 28 usos diretos de `fetch('/api/...')`, verificadores shell incompatíveis com o host, timeouts, i18n e regra Tailwind. O build também avisou: `platform_branding` ausente no banco configurado, credenciais de IA ausentes e `IMPERSONATE_COOKIE_SECRET` ausente/curta.

## 9. Inventário de rotas

### 9.1 Selma

41 páginas compiladas, incluindo: `/`, `/dashboard`, `/login`, `/clientes`, `/clientes/[id]`, `/pedidos`, `/pedidos/[id]`, `/producao`, `/bordados`, `/dtf`, `/sublimacao`, `/oficinas`, `/acabamento`, `/estoque`, `/compras`, `/financeiro`, `/buscar`, `/tarefas`, `/crm`, `/crm/funil`, `/crm/leads`, `/crm/oportunidades/[id]`, `/crm/analytics`, `/crm/reativacao`, `/crm/orcamentos`, `/crm/orcamentos/novo`, `/crm/orcamentos/[id]`, `/proposta/[token]`, `/arte/[token]`, `/comercial`, `/comercial/app/[...slug]`, `/comercial/app/ai/agents` e configurações.

3 APIs compiladas:

- `/api/pedidos/[id]/grade`
- `/api/pedidos/[id]/layout`
- `/api/pedidos/[id]/layout/file`

Não existe diretório/rota `/corte`; corte está modelado como etapa dentro de pedidos/produção, mas o requisito de rota individual não é atendido.

### 9.2 Deskcomm

O build compilou 112 páginas e 254 APIs. Grupos de página: login/cadastro/recuperação/MFA, admin, onboarding, Inbox, contatos, CRM, Kanban, radar, atividades, tarefas, templates, conexões, webhooks, IA, configurações, produtos, integrações, LGPD e agenda. Grupos de API: auth/admin/tenant, contacts, conversations, messages, channels/WAHA/Meta, webhooks, leads/pipelines, automations, cron, AI/RAG/agents, agenda, LGPD, notifications, products e health.

Sob `DESKCOMM_BASE_PATH=/comercial`, o Next prefixa páginas, assets e APIs. Porém 28 chamadas `fetch('/api/...')` ignoram `commercialPath`; somente 13 ocorrências usam o helper. Assim, o manifesto compila, mas partes do runtime buscam APIs no host raiz incorreto quando montadas sob `/comercial`.

## 10. Inventário de testes

| Aplicação | Unit/estático | Integração | SQL/invariantes | Security/Auth/RBAC | E2E/Journeys |
| --- | ---: | ---: | ---: | ---: | ---: |
| Selma | 17 arquivos JS/MJS | 2 arquivos de bridge/single-app dentro dos 17 | 8 arquivos SQL não ligados ao `npm test` | 6 grupos relevantes | 0 |
| Deskcomm | 746 arquivos executados pelo Vitest nessa rodada | distribuídos entre `app`, `lib`, hooks e components | ~187 arquivos detectados; 100 invariantes no harness DB | ~52 por nome/escopo | 109 arquivos |

Deskcomm possui 1.036 arquivos de teste no total: `app` 52, `components` 3, `hooks` 4, `lib` 160, `scripts` 1 e `tests` 816. A existência desses testes é forte, mas o gate atual está vermelho e os testes DB/E2E não foram executados nesta máquina.

## 11. Avaliação lote a lote

| Lote/módulo | Score | Avaliação |
| --- | ---: | --- |
| Lote 1 — Auth e segurança básica | 75% | ✅ Selma valida `getUser`, redirect e APIs 401; 🧪 login ativo/inativo e logout não foram repetidos em E2E nesta auditoria; Deskcomm mantém auth separado |
| Lote 2 — RBAC e RLS | 63% | 🟡 Selma usa permissions server-side e RLS; banco tem alertas e matriz não foi testada com todos os papéis |
| Lote 3 — Audit, Storage e segurança | 59% | 🟡 bons controles no Selma; cobertura de eventos e definers não homologada; alertas Supabase permanecem |
| Lote 4 — Core operacional | 68% | 🧪 RPCs, locks, sequences e idempotência existem; SQL/concurrency não executados |
| Lote 5 — Fundação CRM | 61% | 🧪 UI/RPCs/tabelas existem; fluxo real e concorrência não homologados; CRM duplicado |
| Lote 6 — Inteligência comercial | 57% | 🧪 score, automações, analytics e reativação existem; cron ativo não comprovado |
| Lote 6.5 — UX/UI | 48% | 🟡 design responsivo no código; breakpoints e acessibilidade não homologados visualmente |
| Lote 7 — Orçamentos | 61% | 🧪 domínio amplo no código/SQL; proposta e conversão não testadas em staging |
| Payment terms | 58% | 🧪 templates/rules existem; casos à vista/entrada/30-60/30-60-90 não homologados |
| Deskcomm Atendimento | 24% | ⚠️ produto Deskcomm é extenso isoladamente, mas falha no base path e não está incorporado ao Selma |
| Lote 8/operacional futuro | 42% | 🧪 arte, BOM, compras e capacidade existem em arquivos não rastreados e migrations não homologadas |

## 12. Score por módulo

| Módulo | Score | Observação |
| --- | ---: | --- |
| Segurança | 58% | headers, validação e RLS existem; alertas de privilégios e senha vazada permanecem |
| CRM Selma | 60% | boa cobertura funcional no código, sem E2E/SQL real |
| Inteligência comercial | 55% | regras/analytics presentes, cron não comprovado |
| Orçamentos/propostas | 61% | modelo completo, ainda não homologado |
| Atendimento/WhatsApp | 24% | robusto no repositório Deskcomm, ausente no processo Selma |
| Financeiro | 64% | ledger/recebível separados e RPCs transacionais, sem teste SQL real |
| Operacional | 60% | módulos preservados; novos lotes não homologados |
| Produção | 52% | rotas principais compilam; `/corte` ausente e regressão funcional não executada |
| UX/acessibilidade | 46% | evidência de código, sem matriz visual 390/768/1440/1920 |
| Integração Selma/Deskcomm | 15% | documentação e interface existem; execução ponta a ponta não existe |
| Testes/qualidade | 56% | Selma verde, Deskcomm unit vermelho e DB/E2E pendentes |

## 13. Matriz master de requisitos

Linhas indicam a evidência mais direta. Onde o teste apenas lê texto SQL, o status permanece 🧪.

| ID | Lote | Requisito | Status | Evidência | Arquivo | Linha | Teste | Risco | Correção necessária |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| A-01 | Arquitetura | Um app/processo/login | 🔴 | Dois repos e dois proxies/cookies | ambos `package.json`; Deskcomm `proxy.ts` | 12 | build dos dois | P0 | Consolidar runtime no Selma |
| A-02 | Arquitetura | Selma preserva operação | ✅ | Sem imports Deskcomm nos módulos fabris auditados | `src/app/{producao,bordados,dtf,...}` | — | build Selma | baixo | Manter fronteira |
| A-03 | Arquitetura | Deskcomm só atendimento | ⚠️ | Deskcomm contém CRM, `orders`, produtos e outros domínios | `selmabordados-next/app`, `lib` | — | inventário | P1 | Selecionar módulos a portar |
| A-04 | Arquitetura | Bridge executável | 🔴 | Apenas interface/delegação | `src/lib/integration/deskcomm-commercial-bridge.ts` | 44 | teste estático | P0 | Adapter real + mapping |
| A-05 | Arquitetura | Mapping de entidades | 📋 | Documento prevê `commercial_entity_links`; tabela não encontrada no Selma | `docs/DATABASE-COMPATIBILITY-SELMA-DESKCOMM.md` | — | nenhum | P0 | Projetar e migrar em staging |
| L1-01 | Auth | Login/logout Supabase | 🧪 | ações e `getUser` existem; login completo não repetido | `src/app/login/actions.ts`; `require-user.ts` | 55 | testes auth | médio | E2E por perfil |
| L1-02 | Auth | Rota privada deslogada | ✅ | `/dashboard` → 307 `/login` | `src/lib/supabase/proxy.ts` | — | curl real | baixo | Nenhuma |
| L1-03 | Auth | API 401 sem login | ✅ | 3/3 APIs retornaram 401 | `src/app/api/pedidos/*` | — | curl real | baixo | Nenhuma |
| L1-04 | Auth | Usuário inativo bloqueado | 🧪 | redirect por `profile.active` | `src/lib/auth/require-user.ts` | 98 | estático | alto | Teste autenticado real |
| L1-05 | Auth | Open redirect bloqueado | ✅ | sanitização de path/local origin | `src/lib/auth/session.ts` | 4 | `session.test.mjs` | baixo | Nenhuma |
| L1-06 | Auth | Cookie único | 🔴 | Deskcomm usa `sb-deskcomm-auth`; Selma usa cookie Supabase padrão | Deskcomm `proxy.ts`; Selma server/proxy | 12 | inspeção | P0 | Uma sessão canônica |
| L1-07 | Auth | `.env.example` seguro | ✅ | service role server-only em ambos | ambos `.env.example` | — | inspeção | baixo | Documentar base path final |
| L2-01 | RBAC | Catálogo profiles/roles/permissions | 🧪 | tabelas/RPC/contexto presentes | migrations RBAC; `require-user.ts` | 63 | testes catálogo não executados no DB | alto | Homologar SQL |
| L2-02 | RBAC | Papéis obrigatórios | 🧪 | seeds/regras em migration | `202609060002_rbac_and_granular_rls.sql` | — | teste estático | alto | Testar 8 perfis |
| L2-03 | RBAC | `requirePermission` real | ✅ | páginas/actions chamam guard server-side | `src/lib/auth/require-user.ts` | 118 | autorização 10/10 | baixo | Cobrir APIs futuras |
| L2-04 | RBAC | 403 real | 🧪 | helper retorna 403 e páginas redirecionam | `require-user.ts` | 140 | unitário | alto | Curl/E2E autenticado |
| L2-05 | RBAC | Último administrador/bootstrap | 🧪 | RPCs/testes SQL previstos | migrations RBAC; `rbac-bootstrap.md` | — | SQL não executado | alto | Teste transacional |
| L2-06 | RLS | Todas tabelas protegidas | ⚠️ | RLS ligado, mas 35/13 tabelas sem policy | remotos zask/fzb | — | advisors | alto | Triagem por intenção |
| L2-07 | RBAC | Deskcomm respeita RBAC Selma | 🔴 | usa `user_organizations`/role rank próprio | Deskcomm `lib/auth`, `proxy.ts` | — | unit parcial | P0 | Adapter de autorização único |
| L3-01 | Audit | `audit_logs` append-only | 🧪 | tabela, trigger/helper e ausência de write policy | migration `202609070001` | — | teste estático + SQL não rodado | alto | Homologar DB |
| L3-02 | Audit | Todos eventos obrigatórios | 🟡 | auth/users/orders/finance/CRM/quotes aparecem; atendimento separado | `src/lib/audit`, migrations | — | busca de código | médio | Matriz evento × fluxo |
| L3-03 | Storage | Bucket privado/signed URL | ✅ | bucket privado observado; signed URL server-side | `src/lib/security/storage.ts` | 29 | security 8/8 | baixo | Testar expiração real |
| L3-04 | Storage | MIME/extensão/magic/limite/path | ✅ | validação central; path ignora nome original | `src/lib/security/upload.ts` | 2 | lot3 security | baixo | Adicionar WebP magic bytes |
| L3-05 | Security | Headers | ✅ | CSP, nosniff, referrer, permissions, frame, HSTS, COOP | `next.config.ts` | 11 | curl real | baixo | Revisar CSP sem unsafe-inline no futuro |
| L3-06 | Security | Safe errors/mass assignment | ✅ | Zod strict e sanitização de erro | schemas/actions/errors | — | security tests | baixo | Cobrir novas APIs |
| L3-07 | Security | Service role restrita | 🟡 | módulos server-only; uso administrativo delimitado no Selma; Deskcomm amplo | ambos `lib/supabase/admin.ts` | — | inspeção | alto | Catálogo de cada uso + least privilege |
| L3-08 | Security | Password leak protection | ⚠️ | desativada nos dois projetos | Supabase Auth advisors | — | leitura remota | médio | Ativar no ambiente final |
| L4-01 | Pedidos | Sequence, não MAX+1 | 🧪 | `pedido_number_seq` + `nextval` | `202609070002...sql` | 4,158 | estático/SQL pendente | alto | Concorrência real |
| L4-02 | Pedidos | Create/update transacional | 🧪 | RPCs PL/pgSQL | mesmo arquivo | 147,181 | orders unit; SQL pendente | alto | Teste rollback |
| L4-03 | Pedidos | Idempotência | 🧪 | `client_operation_id` unique | mesmo arquivo | 36 | teste estático | alto | Duplo clique concorrente |
| L4-04 | Financeiro | Recebível ≠ pagamento | ✅ | tabelas separadas e comentário explícito | mesmo arquivo | 53,75,91,271 | finance 2/2 | médio | Homologar lançamentos |
| L4-05 | Financeiro | Pagamento/estorno | 🧪 | RPCs e ledger preservado | mesmo arquivo | 202,256 | finance unit | alto | SQL autenticado |
| L4-06 | Estoque | Ledger/saldo negativo/lock | 🧪 | `FOR UPDATE` em tecido e RPC | mesmo arquivo | 232,244 | security/static | alto | Teste concorrente |
| L4-07 | Datas | São Paulo/dias úteis/feriados | 🧪 | timezone e `crm_add_business_days` | `202609080002...sql` | 452 | 1 teste de data | médio | Casos DST/feriados no DB |
| L4-08 | Dashboard | Peças atrasadas somam itens | ✅ | redução soma `itens_pedido.qtde` | `src/lib/supabase/queries/dashboard.ts` | 32 | type/build | baixo | Teste com fixture real |
| L5-01 | CRM | Modelo completo | 🧪 | 10 entidades principais em migration e remoto | `202609080001...sql` | — | 7 testes | alto | Homologar migrations |
| L5-02 | CRM | Múltiplos contatos/principal | 🧪 | campos e queries existem | `queries/crm.ts` | 17 | unit/static | médio | Teste unicidade/principal |
| L5-03 | CRM | Status de lead | 🧪 | enum/check e UI | migration CRM; leads page | — | unit | médio | E2E |
| L5-04 | CRM | `convert_lead` atômico | 🧪 | RPC PL/pgSQL | `202609080001...sql` | 283 | teste estático | alto | Rollback e duplicidade reais |
| L5-05 | CRM | Duplicidade responsável | 🟡 | normalizações existem, sem prova completa CPF/CNPJ | schemas/migration CRM | — | parcial | alto | Casos controlados sem automerge |
| L5-06 | CRM | Pipeline vindo do DB | 🧪 | `pipelines`/`pipeline_stages` e queries | migration/queries CRM | — | unit | médio | E2E |
| L5-07 | CRM | Kanban persiste e stage history | 🧪 | `move_opportunity_stage` | `202609080001...sql` | 329 | estático | alto | Drag/drop + DB real |
| L5-08 | CRM | Perda exige motivo/concorrente | 🧪 | validação/RPC prevista | migration/actions CRM | — | security unit | médio | E2E |
| L5-09 | CRM | Tasks/atraso/próxima ação | 🧪 | status/queries derivados | `queries/crm.ts` | 98 | unit/build | médio | Homologar datas |
| L5-10 | CRM | Opportunity/Customer 360 | 🟡 | páginas e joins existem; sem atendimento Deskcomm | opportunity/customer pages | — | build | médio | Integrar conversa |
| L5-11 | CRM | Busca Cmd/Ctrl+K | 🟡 | busca inclui domínios Selma; conversa não | `/buscar`, Header | — | build | baixo | Cobrir contatos/conversas finais |
| L6-01 | Comercial | Score configurável/temperatura/override | 🧪 | funções e settings | `202609080002...sql` | 465 | 9 testes | médio | SQL real |
| L6-02 | Comercial | Oportunidade parada | 🧪 | settings, filtro e badge no código | CRM pages/queries | — | unit | médio | E2E temporal |
| L6-03 | Comercial | Follow-ups | 🧪 | regras e tasks automáticas | `202609080002...sql` | 560 | unit/static | médio | Rodar scheduler |
| L6-04 | Comercial | Automations idempotentes | 🧪 | `automation_runs.idempotency_key` | migration commercial | — | unit/static | alto | Execução concorrente |
| L6-05 | Comercial | Cron ativo | ❓ | função diária existe; ativação não comprovada | migration/runbook | — | nenhum runtime | alto | Cron observável em staging |
| L6-06 | Comercial | Analytics | 🟡 | receita/funil/origem/vendedor/perdas implementados; consultas limitadas em memória | analytics + queries | 64 | build/unit | médio | Volume/performance real |
| L6-07 | Comercial | Reativação | 🧪 | modos 90/180/365/no orders/recompra/high ticket | `crm/reativacao/page.tsx` | 10 | build | médio | E2E |
| L6-08 | Comercial | Forecast/metas/saved views/notificações | 🧪 | tabelas/RPCs/UI em graus variados | migration commercial | — | unit/static | médio | Homologar por perfil |
| UX-01 | UX | Padrão visual consistente | 🟡 | tokens/classes CRM e layouts presentes | `globals.css`, componentes CRM | — | lint/build | médio | QA visual |
| UX-02 | UX | 390/768/1440/1920 | 🧪 | breakpoints no código; não medidos visualmente | pages/components | — | não executado | médio | Playwright screenshots |
| UX-03 | UX | Acessibilidade | 🟡 | labels/ARIA/focus aparecem; cobertura incompleta | pages/components | — | lint; E2E não rodado | médio | Axe + teclado |
| L7-01 | Quotes | Tabelas e sequence | 🧪 | 6 entidades + `quote_number_seq` | `202609080003...sql` | 6 | 23 testes | alto | Aplicar/homologar em staging |
| L7-02 | Quotes | Versões/snapshot/imutabilidade | 🧪 | versionamento e locks | `202609090004...sql` | 83 | security/static | alto | E2E v1/v2 |
| L7-03 | Quotes | Itens/grade/pricing/custo/margem | 🧪 | editor, schemas e cálculos | quote components/domain | — | pricing tests | médio | Persistência real |
| L7-04 | Quotes | Desconto/aprovação | 🧪 | permission e fluxo de approval | quote actions/migration | — | security tests | alto | Vendedor x gerente real |
| L7-05 | Quotes | Proposta pública segura | 🧪 | hash SHA-256, expiração e DTO | `202609090004...sql` | 206 | estático/SQL pendente | alto | Token/replay/mobile |
| L7-06 | Quotes | Views e solicitação de alteração | 🧪 | first/last/count e notifications | mesmo arquivo | 218 | estático | médio | E2E |
| L7-07 | Quotes | Aprovação versão atual | 🧪 | `approve_quote_version` com locks | mesmo arquivo | 223 | estático | alto | Concorrência/replay |
| L7-08 | Quotes | Quote → Order atômico/idempotente | 🧪 | `FOR UPDATE`, source quote unique e parcelas | mesmo arquivo | 123 | security/static | P0 | Teste rollback/concurrency |
| PT-01 | Terms | Templates padrão e customizados | 🧪 | migration dedicada e snapshots | `202609090001_payment_term_management.sql` | — | estático | médio | Casos reais |
| D-01 | Deskcomm | Inbox 3 painéis | 🧪 | implementação existe no app separado | Deskcomm `app/app/inbox` | — | unit parcial | alto | Portar e E2E no Selma |
| D-02 | Deskcomm | Conversations/messages/media | 🧪 | schema/API/UI extensos | Deskcomm app/lib/migrations | — | milhares de units | alto | Staging integrado |
| D-03 | Deskcomm | Webhook idempotente | 🧪 | external id/unique e testes existem | `lib/waha`, migrations | — | unit passou em parte | alto | Replay real |
| D-04 | Deskcomm | WAHA/Meta adapters | 🧪 | adapters e rotas existem; serviço não configurado | `lib/waha`, channels APIs | — | build | alto | Ambiente externo isolado |
| D-05 | Deskcomm | Base path completo | ⚠️ | 28 fetches raiz; testes de contrato falham | Deskcomm app/components/hooks | — | unit vermelho | P0 | Unificar helper/rewrite |
| D-06 | Deskcomm | Realtime | 🧪 | código de subscription/token; sem teste conectado | Deskcomm realtime/hooks | — | unit parcial | alto | E2E duas sessões |
| D-07 | Deskcomm | Auth/RBAC único | 🔴 | cookie e modelo próprios | Deskcomm `proxy.ts`, auth libs | 12 | inspeção | P0 | Usar sessão/RBAC Selma |
| D-08 | Deskcomm | Pedido no Inbox lê Selma | 🔴 | Deskcomm consulta `orders`, não `pedidos` | `lib/mcp/tools/comercio.ts` | 41 | inspeção | P0 | Bridge read-only |
| D-09 | Deskcomm | Fluxo WhatsApp → Pedido Selma | 🔴 | nenhuma implementação ponta a ponta | ambos repos | — | nenhum | P0 | Bridge + mappings + testes |
| NR-01 | Regressão | Rotas fabris compilam | 🟡 | produção, bordado, DTF, sublimação, oficinas, acabamento, estoque, compras, financeiro e pedidos compilam | Selma routes | — | build | médio | Smoke autenticado |
| NR-02 | Regressão | `/corte` individual | 🔴 | rota ausente | `src/app` | — | build manifest | P1 | Decidir rota ou documentar equivalência |
| OP-01 | Operacional | Arte/ficha/BOM/reserva/compras/PCP | 🧪 | migrations/actions/UI não rastreadas | `src/app/operacional`; migrations lote 8 | — | 19 tests estáticos | alto | SQL + E2E staging |
| OP-02 | Operacional | Concorrência de reserva/recebimento | 🧪 | `FOR UPDATE`, `operation_id UNIQUE` | migrations material/purchasing | 123,162 | SQL não rodado | alto | Corrida real |
| PERF-01 | Performance | Paginação/limites | 🟡 | várias queries limitadas; algumas agregações até 5.000/em memória e `select('*')` | queries commercial/operations | 64,47 | inspeção | P2 | EXPLAIN + paginação |
| MIG-01 | Migrations | Histórico reproduzível | ⚠️ | 20/213 locais versus 2/0 remotas | migrations e ledger remoto | — | leitura | P0 | Baseline/ledger canônico |
| TEST-01 | Testes | Gates verdes nos dois apps | 🔴 | Deskcomm unit e audit vermelhos | package scripts | — | comandos reais | P1 | Corrigir e rerodar |
| TEST-02 | Testes | DB/SQL/E2E | 🧪 | sem Docker/Bash/staging isolado | test harnesses | — | não executado | P0 | Ambiente descartável |
| DOC-01 | Docs | Arquitetura oficial coerente | 🟡 | documento correto como alvo, mas descreve estado não atingido | `ARCHITECTURE-SELMA-DESKCOMM.md` | — | comparação código | médio | Marcar alvo x atual |
| DOC-02 | Docs | Sem credenciais/documentos perigosos | ⚠️ | épico contém credencial histórica em texto | Deskcomm `EPIC-01-auth-app-shell.md` | 1186 | inspeção | P1 | Rotacionar e remover do histórico aplicável |

## 14. Fluxos obrigatórios

| Fluxo | Resultado |
| --- | --- |
| Login → dashboard Selma | 🧪 Proteção anônima validada; credencial/perfis não reexecutados |
| Cliente → lead → oportunidade → stage → tarefa | 🧪 Código e RPCs presentes; sem E2E/SQL desta árvore |
| Oportunidade → orçamento → proposta → aprovação → pedido | 🧪 Código presente; sem homologação transacional |
| Pedido → pagamento/recebível → estoque → produção | 🧪 RPCs e UI presentes; sem execução controlada |
| Connection → conversation → message → assignment → reply → realtime | 🧪 Existe no Deskcomm isolado; não validado nesta máquina |
| WhatsApp → mensagem → contato → lead → funil → orçamento Selma → pedido Selma | 🔴 Não existe como fluxo integrado |

## 15. Concorrência e idempotência

| Operação | Evidência | Status |
| --- | --- | --- |
| Número de pedido | sequence | 🧪 não submetido a concorrência |
| Número de orçamento | sequence | 🧪 não submetido a concorrência |
| Criação de pedido | `client_operation_id` unique | 🧪 |
| Conversão quote → order | lock + unique `source_quote_id` | 🧪 |
| Pagamento | operação única por usuário/id | 🧪 |
| Estoque | `FOR UPDATE` | 🧪 |
| Recebimento de compra | `operation_id UNIQUE` | 🧪 |
| Mensagem/webhook Deskcomm | external id/unique/dedup | 🧪 app separado |
| Recebível | criado dentro da conversão | 🧪 rollback não testado |

Não houve teste real com duas conexões concorrentes. Portanto nenhum desses itens pode ser promovido para ✅.

## 16. Não regressão da produção Selma

O build confirma que `/producao`, `/bordados`, `/dtf`, `/sublimacao`, `/oficinas`, `/acabamento`, `/estoque`, `/compras`, `/financeiro` e `/pedidos` compilam. Não foram encontrados imports Deskcomm nesses domínios. `/corte` não existe como rota independente. Os hashes documentados em `DATABASE-COMPATIBILITY-SELMA-DESKCOMM.md` não foram usados como gate porque a árvore já estava suja e os hashes não estão ligados a um commit-base verificável.

Conclusão: 🟡 **preservação estrutural confirmada, preservação funcional não homologada**.

## 17. Documentação

### Atual e útil

- `ARCHITECTURE-SELMA-DESKCOMM.md`: decisão arquitetural correta, mas deve distinguir alvo e implementação atual.
- `DATABASE-COMPATIBILITY-SELMA-DESKCOMM.md`: inventário de colisões e cautela de banco coerentes.
- runbooks Lotes 3–8: úteis como roteiro de homologação, vários declaram corretamente “aguardando homologação”.
- `rbac-bootstrap.md` e `backup-restore-supabase.md`: relevantes para staging.

### Obsoleta, histórica ou potencialmente contraditória

- `deskcomm-commercial-integration.md` está corretamente marcado como substituído.
- Os muitos PRDs, épicos, handoffs, plans e evidence do Deskcomm descrevem o Deskcomm como produto completo independente; não podem ser usados como instrução de arquitetura Selma.
- `docs/stories/epics/EPIC-01-auth-app-shell.md:1186` contém uma credencial histórica em claro. Mesmo indicada para troca, deve ser considerada comprometida.
- `docs/ARCHITECTURE-SELMA-DESKCOMM.md` diz que “proxy e servidor comercial separados foram removidos”, mas o segundo repositório continua executável com `proxy.ts`, cookie próprio e base path. A frase é verdadeira apenas como alvo do repositório Selma, não do workspace completo.

## 18. Prioridades

### P0

1. Dois aplicativos/auth/RBAC permanecem; não há sistema único.
2. Bridge/mapping e fluxo Deskcomm → orçamento/pedido Selma não existem.
3. Histórico de migrations é divergente (20/213 locais versus 2/0 remotas), impedindo reprodução confiável.
4. Montagem Deskcomm em `/comercial` quebra contratos de API; 28 fetches raiz e testes falhando.

### P1

1. Deskcomm `test:unit` vermelho: 28 falhas.
2. Deskcomm possui 3 vulnerabilidades moderadas transitivas em Hono.
3. SQL, RLS por papel, E2E e concorrência não homologados.
4. Dois CRMs/pipelines/automações e tabelas colidentes sem fonte única executável.
5. `db:migrate` Deskcomm é placeholder.
6. `/corte` ausente como rota requerida.
7. Configuração atual aponta Deskcomm para schema incompatível; `platform_branding` não existe.
8. Credencial histórica exposta em documentação deve ser considerada comprometida.

### P2

1. Alertas de RLS sem policy e grants de functions precisam de triagem.
2. Proteção contra senhas vazadas desativada.
3. Centenas de FKs sem índice/policies múltiplas/índices duplicados ou não usados.
4. 344 warnings de lint no Deskcomm.
5. Cron Selma não possui prova de ativação/observabilidade.
6. Queries com agregação limitada e cálculo em memória podem truncar analytics.
7. Documentação mistura estado-alvo, histórico e estado atual.

### P3

1. QA visual nos quatro breakpoints.
2. Auditoria Axe/teclado/contraste completa.
3. Remover dependência de Google Fonts em build offline ou documentar requisito.
4. Reduzir warnings/depreciações, inclusive Sentry.

## 19. Conclusão

O Selma principal tem uma base técnica considerável e gates locais verdes, mas grande parte dos Lotes 4–8 permanece **implementada no código e não homologada no banco/fluxo**. O Deskcomm é um produto amplo e testado em seu próprio modelo, porém ainda é um segundo sistema. A navegação `/comercial` do Selma mascara essa separação por meio de placeholders e redirects; não a resolve.

O conjunto só poderá ser chamado de “sistema único” depois que o runtime, a sessão, o RBAC, o modelo de entidades e a ponte para orçamento/pedido Selma forem únicos e validados em staging isolado. Até lá, o resultado correto é **🔴 REPROVADO para produção como solução unificada**.
