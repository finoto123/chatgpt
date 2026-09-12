# Plano deferido do banco definitivo

Data da decisão: 12/09/2026
Status: **⏸ DEFERIDO POR DECISÃO DO PRODUTO**

## Decisão

O banco atualmente conectado não é o banco definitivo da aplicação. Ele pode ser usado somente como modelo, referência, fonte de dados de exemplo e apoio visual por consultas não destrutivas. O produto será completado primeiro por contratos, services, adapters, mocks e fixtures; o banco real será projetado depois, sem obrigar a UI ou o domínio a espelhar o schema temporário.

Não criar projeto Supabase de staging durante o Track A. Não corrigir o ledger atual, reconstruir migrations históricas, aplicar SQL, homologar RLS/RPCs, criar usuários fictícios ou alterar dados nos projetos de referência.

## Evidência preservada

- snapshot A1 e restore dry-run aprovados;
- fingerprints e checksums preservados;
- Supabase CLI `2.117.0` instalada isoladamente;
- migrations atuais mantidas sem alteração e classificadas como `LEGACY / PROVISIONAL`;
- inventários e ledgers remotos anteriores mantidos somente como referência.

## Validações adiadas

- baseline definitivo e schema diff;
- migrations finais e ledger canônico;
- Auth remoto, RLS, policies e RPCs reais;
- constraints, índices e concorrência PostgreSQL;
- Storage e Realtime reais;
- seed, backup e restore definitivos;
- migração dos dados legados;
- performance SQL e E2E com infraestrutura real.

## Requisitos do banco futuro

O Database Master Design deverá definir entidades, schemas, PK/FK, constraints, índices, isolamento organizacional, autorização, auditoria, funções, RPCs, Storage, Realtime, migrations, seed, backup, restore e migração de dados. A instalação limpa e a atualização incremental deverão ser reproduzíveis e idempotentes.

## Contratos exigidos durante o Track A

- `AuthRepository` e `AuthorizationRepository`;
- `SessionProvider`;
- repositories de Customer, Opportunity, Quote, Order, Inventory, Production, Finance e Conversation;
- `MessagingProvider` e `RealtimeProvider`;
- `AnalyticsDataProvider`;
- `AIProvider`/AI Gateway;
- `FiscalProvider`;
- mappers explícitos `DatabaseRow ↔ DomainEntity` somente quando os adapters reais forem criados.

As interfaces pertencem à aplicação e não devem importar tipos gerados do banco. Adapters mock/fixture são implementados no Track A; adapters Supabase ficam `🧪 IMPLEMENTADO — AGUARDANDO BANCO REAL` até o Track DB.

## Sequência futura

1. DB-1 Modelo definitivo
2. DB-2 Schema
3. DB-3 Migrations
4. DB-4 Auth/RLS
5. DB-5 Storage/Realtime
6. DB-6 Migração de dados
7. DB-7 Performance/índices
8. DB-8 Backup/restore
9. DB-9 E2E real
10. DB-10 Go-live

Nenhuma dessas fases bloqueia APP-1 a APP-15.
