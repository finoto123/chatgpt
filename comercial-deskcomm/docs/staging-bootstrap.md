# Bootstrap do `selmabordados-next-staging`

Este runbook cria a infraestrutura nova do DeskcommCRM. Ele nunca deve ser executado contra o projeto Supabase legado da Selma.

## Estado atual

- Projeto staging: **ainda não criado**.
- Supabase CLI: **não instalada neste computador**.
- `SUPABASE_ACCESS_TOKEN`: **não configurado no ambiente**.
- URL/senha PostgreSQL do staging: **não disponíveis**.
- Painel Supabase via automação: **bloqueado por uma preferência salva do navegador desta sessão**.
- Baseline auditado: `supabase/baseline.sql`, SHA-256 `2EA61152C31AB0DBFB605B31CA27D5C893FFB33374A02C12703250A9C02ED300`.

## Guardas antes de executar

1. Confirmar no painel que o nome do projeto é `selmabordados-next-staging`.
2. Confirmar que o project ref é diferente do projeto legado `zaskzrplimoudreqodbf`.
3. Guardar a URL PostgreSQL do projeto novo apenas em variável de ambiente local; não escrever credenciais em documentação, comandos versionados ou saída de CI.
4. Usar uma conexão com permissão para extensões e DDL. A service-role key da API não substitui a senha/URL PostgreSQL.
5. Não executar `supabase db push` em banco vazio: as migrations iniciais são stubs e não criam o schema fundacional.

## Aplicação do baseline

Com `SUPABASE_DB_ADMIN_URL` apontando para o banco **novo**:

```bash
psql "$SUPABASE_DB_ADMIN_URL" -v ON_ERROR_STOP=1 -c \
  'create extension if not exists vector with schema public;
   create extension if not exists citext with schema public;
   create extension if not exists pg_trgm with schema public;'

psql "$SUPABASE_DB_ADMIN_URL" -v ON_ERROR_STOP=1 -f supabase/baseline.sql
```

Reaplicar o mesmo baseline uma segunda vez com `ON_ERROR_STOP=1`. A segunda execução é a prova inicial de idempotência exigida pelo DeskcommCRM.

Se o terminal não estiver disponível, o SQL Editor pode executar primeiro as três extensões e depois o conteúdo integral de `supabase/baseline.sql`. Conferir novamente o project ref antes de cada consulta.

## Verificação mínima do banco novo

Executar no SQL Editor do **staging novo**:

```sql
select extname
from pg_extension
where extname in ('vector', 'citext', 'pg_trgm')
order by extname;

select to_regclass('public.organizations') as organizations,
       to_regclass('public.user_organizations') as memberships,
       to_regclass('public.contacts') as contacts,
       to_regclass('public.crm_leads') as crm_leads,
       to_regclass('public.conversations') as conversations,
       to_regclass('public.messages') as messages,
       to_regclass('public.event_log') as event_log,
       to_regclass('public.automation_rules') as automation_rules,
       to_regclass('public.crm_tasks') as crm_tasks;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'organizations', 'user_organizations', 'contacts', 'crm_leads',
    'conversations', 'messages', 'event_log', 'automation_rules', 'crm_tasks'
  )
order by tablename;

select has_table_privilege('anon', 'public.contacts', 'select') as anon_reads_contacts,
       has_table_privilege('anon', 'public.crm_leads', 'select') as anon_reads_crm_leads,
       has_table_privilege('anon', 'public.crm_tasks', 'select') as anon_reads_crm_tasks;
```

Resultado esperado:

- três extensões presentes;
- todas as relações resolvidas, sem `null`;
- RLS ativa nas tabelas verificadas;
- `anon_reads_contacts`, `anon_reads_crm_leads` e `anon_reads_crm_tasks` iguais a `false`.

## Storage

Criar o bucket `whatsapp-media` como privado. O bucket de arquivos operacionais da Selma será definido apenas na migration do domínio Selma e também será privado; não copiar a política antiga do bucket `pedidos-layouts`.

## Configuração local mínima

Criar `.env.local` a partir de `.env.example`, sem versionar, e preencher pelo menos:

- `NEXT_PUBLIC_SUPABASE_URL` do staging novo;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` do staging novo;
- `SUPABASE_SERVICE_ROLE_KEY` do staging novo;
- `SUPABASE_DB_URL` do staging novo;
- segredos locais exigidos pelo validador de ambiente.

Não reutilizar a service-role key legada no projeto novo.

## Validação antes do white label

1. Rodar a aplicação apontada somente para o staging novo.
2. Criar uma conta de teste e concluir o onboarding nativo.
3. Confirmar criação de organização, membership e isolamento de tenant.
4. Exercitar login, contatos, CRM, Inbox sem canal, tarefas e configurações.
5. Rodar os testes de banco em ambiente com Docker/Bash: `pnpm test:db`.
6. Rodar E2E com a infraestrutura local exigida: `pnpm test:e2e`.
7. Registrar resultados em `docs/deskcomm-migration.md`.

Somente depois desses passos ficam liberadas a marca Selma, a organização inicial definitiva e as migrations do domínio de confecção.

## Critério de interrupção

Interromper imediatamente se qualquer URL, project ref, nome de organização ou tabela indicar o banco legado. Não tentar “corrigir” o legado aplicando baseline, migrations do Deskcomm ou DDL manual.
