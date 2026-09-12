# Fase A1 — Estado Reproduzível

Data: 11/09/2026
Fase: A1 do Plano Master
Resultado do gate: **A1-APP ✅ APROVADO · A1-DB ⏸ DEFERIDO POR DECISÃO DO PRODUTO**

## Escopo executado

Esta fase executou o delta check exigido pelo Prompt Master, congelou os dois worktrees em snapshot externo, validou todos os hashes, realizou restore dry-run do código e instalou a Supabase CLI de forma isolada. Não houve commit, push, reset, clean, restore da árvore Git, migration, alteração de banco ou funcionalidade nova.

## Decisão de produto vigente

Em 12/09/2026 a A1 foi dividida em dois gates independentes. O estado de código reproduzível passa a ser `A1-APP` e está aprovado. Dump, baseline legado, staging Supabase, restore de banco e homologação PostgreSQL passam a `A1-DB`/`DB-1` e ficam deferidos até a aplicação estar funcionalmente completa. O adiamento é uma decisão de produto, não um defeito da aplicação.

## Delta desde a auditoria

O marco temporal usado foi a gravação de `docs/MASTER-SYSTEM-AUDIT.md`, em `2026-09-11T14:56:06-03:00`.

Depois desse marco, somente estes arquivos mudaram:

- `docs/FUNCTIONAL-BENCHMARK.md`
- `docs/MASTER-FIX-PLAN.md`

Nenhum arquivo em `src/`, `supabase/`, `app/`, `lib/`, `components/` ou `hooks/` foi modificado depois da auditoria. Nenhuma migration nova apareceu depois do baseline. Portanto, os diagnósticos técnicos de `MASTER-SYSTEM-AUDIT.md` foram aceitos sem reauditoria.

## Commits-base

| Repositório | Branch | Commit-base | Último commit |
| --- | --- | --- | --- |
| Selma `selmabordados-1` | `main` | `c2c42ab8e81713e99b3974d6f489b5c3b3fac79c` | `c2c42ab feat: redesign CRM and stabilize order drafts` |
| Deskcomm `selmabordados-next` | `main` | `1c9a46a180835cd21bcd74a732fba085df8f3e13` | `1c9a46a1 Merge pull request #640 from melgarafael/fix/memoria-historico-encerrado` |

Esses commits não contêm todo o estado auditado, pois há alterações locais rastreadas e não rastreadas nos dois repositórios.

## Classificação das alterações locais

| Grupo | Origem/intenção | Estado |
| --- | --- | --- |
| Selma: auth, RBAC, CRM, quotes, pedidos, UI e segurança | Implementação anterior à auditoria | Local, sem commit |
| Selma: arte, ficha técnica, BOM, reservas, compras e capacidade | Lote 8 anterior à auditoria | Local, sem commit e sem homologação |
| Selma: `/comercial`, bridge e rotas de fachada | Tentativa anterior de unificação | Local; bridge ainda sem adapter real |
| Selma: documentos Master/Benchmark | Auditoria e planejamento | Local, sem commit |
| Deskcomm: base path, API client, auth realtime, Inbox/mídia | Tentativa anterior de montagem em `/comercial` | Local, sem commit; testes vermelhos no baseline |
| Deskcomm: preview e documentos de staging/migration | Suporte à tentativa anterior | Local, sem commit |

Não foi possível converter essa separação em branches ou commits porque o Prompt Master proíbe commit e push nesta fase.

## Fingerprints do estado

Os aggregates abaixo são SHA-256 de uma lista ordenada no formato `caminho<TAB>sha256`, usando `<deleted>` para arquivos rastreados removidos. Eles detectam alteração, mas não substituem uma cópia/commit capaz de restaurar os bytes.

### Selma

| Manifesto | Arquivos | SHA-256 agregado |
| --- | ---: | --- |
| Delta de produto local, excluindo os relatórios Master/A1 | 79 | `11b930b768e742bdae3e91f0bc9dba51b6df60deaef0418d8997c53e54e93923` |
| Rotas (`page.tsx` + `route.ts`) | 44 | `ed6f884097e9c6062f38ed1f2ff840c3c56b5089bf9255b46d4d07f7372bb9ef` |
| Testes JS/MJS/TS/SQL | 25 | `6bec5a23954610e0b1375b4347e039eb920b475c8700629c8f68590f00cc30e9` |
| Migrations SQL | 20 | `a7fb90b6ce2477d7625dff8fa302de7b0fc25fffc48bf55c69f6c21a6449e171` |
| `package-lock.json` | 1 | `f6cdb1f7562af41393562739cb5bdc5b3776b47ed28e15e222aad1dad460cb08` |
| `package.json` | 1 | `97aea097827d8c3e95de58eb125494c08be5bb872843dbbaae32519ac8d802d0` |

Inventário de banco aceito do baseline: 51 tabelas declaradas, 110 funções, 3 views, 3 sequences, 136 policies e 27 triggers nas migrations Selma. O projeto remoto de referência `zaskzrplimoudreqodbf` tinha somente 2 migrations registradas, portanto seu ledger não reproduz os 20 arquivos locais.

### Deskcomm

| Manifesto | Arquivos | SHA-256 agregado |
| --- | ---: | --- |
| Delta local | 29 | `47121212bbcb21d985c0acfe834e2755fcc4eb014e68a7ee988639d7e65a7caa` |
| Rotas (`page.tsx` + `route.ts`) | 366 | `ca19974989ee0568ff71fc29dcaebd2504052e4d5fcc877d5369d944d71b3f2a` |
| Testes | 1.036 | `d7e696d3cd95dbc379a8508ca74433eb3636459b0364ad6c807a9813a701536a` |
| Migrations SQL | 213 | `869f450e945af1db3f2a384b55431c6f946568ca5dc65581d6c7c97ad42f4326` |
| `pnpm-lock.yaml` | 1 | `bb8521ec6df616a32c77f38880341788b4f3d3ecb490a267fc778a5c018199d8` |
| `package.json` | 1 | `e06ca9da87a1fed0fb7c96fadfe5297ef7b5687c19686462eb1c30f7f842389a` |

Inventário de banco aceito do baseline: aproximadamente 93 tabelas declaradas, 154 funções, 3 views, 118 policies e 78 triggers detectados nas migrations Deskcomm. O projeto remoto de referência `fzbkzugukvngsbygzgjn` tinha zero migrations registradas.

## Snapshot não destrutivo validado

Snapshot concluído em `C:\Users\gabri\Downloads\selma-snapshots\2026-09-11-A1`.

| Repositório | Arquivos | Bytes | SHA-256 agregado | Cópia | Restore dry-run | Delta local preservado |
| --- | ---: | ---: | --- | --- | --- | ---: |
| `selmabordados-1` | 1.528 | 534.369.085 | ver manifesto externo | PASS | PASS | 79 |
| `selmabordados-next` | 3.936 | 90.025.341 | ver manifesto externo | PASS | PASS | 29 |

Os hashes agregados definitivos ficam somente no `SNAPSHOT-MANIFEST.md` externo, evitando que um arquivo incluído no próprio cálculo tente registrar o hash de si mesmo.

O diretório contém `SNAPSHOT-MANIFEST.md`, `SHA256SUMS.txt`, manifestos TSV por arquivo e as duas cópias de restore. A verificação independente encontrou zero manifesto obrigatório ausente e zero `.env*` real copiado; somente arquivos de exemplo foram permitidos. A varredura heurística encontrou possíveis padrões de credencial em 3 arquivos versionados Selma e 138 Deskcomm. Nenhum valor foi transcrito para os manifestos; a ocorrência exige revisão e rotação na fase de segurança.

## Ambiente de ferramentas

| Ferramenta | Versão/estado |
| --- | --- |
| Node.js | `v22.23.2` |
| npm | `10.9.8` |
| pnpm do Deskcomm | `9.15.9` |
| Git | `2.55.0.windows.5` |
| Supabase CLI | `2.117.0`, instalação isolada em `C:\Users\gabri\Downloads\selma-snapshots\2026-09-11-A1\tools\supabase-cli` |
| Docker daemon | indisponível nesta máquina durante a fase |
| Postgres dos projetos de referência | `17.6`, conforme baseline read-only |

A CLI foi instalada com `package.json` e `package-lock.json` próprios, sem instalação global e sem alteração dos package files dos dois projetos. O audit dessa pasta retornou zero vulnerabilidades.

## Banco real — deferido

A leitura já realizada dos ledgers remotos foi estritamente read-only e permanece apenas como evidência histórica:

- `zaskzrplimoudreqodbf`: `20260911171437_harden_function_search_paths` e `20260911172132_restore_application_rpcs`;
- `fzbkzugukvngsbygzgjn`: nenhuma migration registrada.

Os 20 arquivos Selma não formam, sozinhos, uma instalação limpa: os três arquivos legados iniciais alteram `pedidos`/`itens_pedido` e pressupõem um schema-base ausente do repositório. Também existem versões conflitantes (`002` em dois arquivos e `202609090001` em dois arquivos). A ordem de dependência a ensaiar no staging, depois de obter e classificar um baseline de schema sem dados, é:

1. baseline canônico do núcleo legado, ainda inexistente e que não pode ser inferido cegamente do ledger remoto;
2. `001_add_missing_columns.sql`;
3. `002_itens_pedido_observacao.sql`;
4. `002_create_pedidos_layouts_bucket.sql`;
5. `003_lock_down_rls.sql`;
6. `202609060001_authenticated_access_baseline.sql`;
7. `202609060002_rbac_and_granular_rls.sql`;
8. `202609070001_audit_storage_security.sql`;
9. `202609070002_order_finance_integrity.sql`;
10. `202609080001_crm_foundation.sql`;
11. `202609080002_commercial_intelligence.sql`;
12. `202609080003_quotes_proposals.sql`;
13. `202609090001_login_audit_repair.sql`;
14. `202609090001_payment_term_management.sql`;
15. `202609090002_order_draft_persistence.sql`;
16. `202609090003_order_draft_stability.sql`;
17. `202609090004_quote_professional_completion.sql`;
18. `202609100001_art_and_technical_sheet.sql`;
19. `202609100002_material_planning.sql`;
20. `202609100003_purchasing.sql`;
21. `202609100004_production_capacity.sql`.

Essas pendências foram movidas para `docs/DATABASE-DEFERRED-PLAN.md`. Até o início do Track DB não haverá `db push`, staging, reconstrução de baseline, correção de ledger ou aplicação das migrations atuais. Os arquivos SQL permanecem preservados e classificados como `LEGACY / PROVISIONAL`.

## Evidência de build aceita do baseline

Como nenhum código mudou após a auditoria, a regra de delta permitiu aceitar os resultados existentes:

- Selma: lint 0, typecheck 0, 100 testes aprovados, audit 0 vulnerabilidades e build 0.
- Deskcomm: typecheck 0, lint com 344 warnings, unit tests com 28 falhas, audit com 3 vulnerabilidades moderadas e build 0 somente com rede disponível.

Consequentemente, “build reproduzível” permanece 🧪: houve build bem-sucedido da árvore, mas não a partir de checkout limpo e não com todos os gates verdes.

## Gate A1 dividido

| Critério | Estado | Evidência/pendência |
| --- | --- | --- |
| Commits-base definidos | ✅ | Dois SHA completos registrados |
| Delta desde a auditoria identificado | ✅ | Apenas dois documentos mudaram antes desta fase |
| Alterações locais separadas por intenção | ✅ | Classificação registrada acima |
| Manifestos/fingerprints | ✅ | Rotas, testes, migrations, locks e delta registrados |
| Versões registradas | ✅ | Runtime/gerenciadores/Git e Supabase CLI `2.117.0` registrados |
| Estado de código reproduzível | ✅ | Snapshot externo preserva worktrees sujos sem alterar Git; hashes e restore dry-run passaram |
| Backup read-only de schema | ⏸ | Deferido para DB-8 |
| Restore de código em ambiente descartável | ✅ | As duas cópias reconstruídas bateram integralmente nos hashes |
| Staging exclusivo identificado | ⏸ | Deferido; não criar staging durante o Track A |
| Builds reproduzíveis a partir do estado congelado | 🧪 | Builds do baseline existem; novo build a partir do restore não foi necessário para validar identidade dos bytes |
| Testes independentes do banco real | 🧪 | Passa a ser exigido por fase APP com mocks, fixtures e contratos |

## Resultado

**A1-APP: ✅ APROVADO.** Código congelado, fingerprints, hashes, restore dry-run e ferramentas foram preservados. APP-1 pode iniciar.

**A1-DB: ⏸ DEFERIDO POR DECISÃO DO PRODUTO.** As pendências abaixo não bloqueiam mais as fases APP:

1. projeto/staging do banco definitivo;
2. dump, baseline e restore de banco;
3. schema, migrations, Auth/RLS, Storage/Realtime e índices definitivos;
4. migração de dados, performance SQL e E2E real.

A execução segue agora pelo Track A. O Track DB só começa depois de APP-15.
