# Lote 2 — publicação do RBAC e primeiro administrador

Esta implementação mantém `auth.users` como fonte de identidade. `public.profiles`
guarda somente os dados de exibição e o status; não existe senha nem autenticação
paralela no schema público.

## Ordem segura de publicação

1. Execute e valide o backup descrito em `docs/backup-restore-supabase.md`.
2. Restaure esse backup em um projeto descartável e confirme as contagens.
3. Configure um projeto de staging separado, com URL e chaves próprias.
4. Crie no Supabase Auth o usuário que será o primeiro administrador. Use o
   painel Authentication > Users e copie o UUID, não apenas o e-mail.
5. Aplique em staging, na ordem, as migrations ainda não aplicadas:
   `202609060001_authenticated_access_baseline.sql` e
   `202609060002_rbac_and_granular_rls.sql`. A segunda remove a policy ampla da
   primeira e instala as policies finais.
6. No SQL Editor, como proprietário do banco, execute uma única vez:

```sql
select public.bootstrap_first_administrator(
  '<UUID-COPIADO-DE-auth.users>'::uuid
);
```

A função usa lock transacional, recusa UUID inexistente e recusa um segundo
bootstrap quando já existe administrador ativo. `authenticated`, `anon` e
`service_role` não possuem `EXECUTE`; portanto esse passo não cria um backdoor
na aplicação.

7. Verifique o vínculo:

```sql
select p.id, p.email, p.active, r.code
from public.profiles p
join public.user_roles ur on ur.user_id = p.id
join public.roles r on r.id = ur.role_id
where p.id = '<UUID-COPIADO-DE-auth.users>'::uuid;

select count(*) as permissoes_do_administrador
from public.user_roles ur
join public.role_permissions rp on rp.role_id = ur.role_id
where ur.user_id = '<UUID-COPIADO-DE-auth.users>'::uuid;
```

O resultado esperado é `active = true`, `code = administrator` e 38 permissões.

8. Execute `supabase/tests/rbac_catalog.sql`.
9. Crie cinco identidades exclusivas de teste, preencha os UUIDs de
   `supabase/tests/rbac_integration_template.sql` e execute o roteiro em
   staging. Ele termina com `ROLLBACK`.
10. Faça login como administrador, abra `/configuracoes/usuarios`, envie um
    convite, atribua um papel e valide a matriz em
    `/configuracoes/permissoes`.
11. Só depois publique o código da aplicação. Repita o processo em produção
    após registrar evidências e aprovação da validação de staging.

## Convites de usuários

O fluxo escolhido é `inviteUserByEmail` do Supabase Auth. A Server Action:

- exige `users.manage` antes de criar o cliente administrativo;
- aceita somente nome e e-mail validados;
- roda em módulo exclusivamente server-side;
- não recebe senha e não retorna chave ou segredo;
- depende de SMTP e Site URL/Redirect URLs configurados no projeto Supabase.

O trigger `auth_user_sync_rbac_profile` cria/atualiza `profiles`. Um convidado
novo fica ativo, porém sem papel e sem permissão até que um administrador faça a
atribuição. Não habilite cadastro público para substituir esse fluxo.

## Service role restante

Há somente dois usos funcionais, ambos através de
`src/lib/supabase/admin.ts`, que importa `server-only`:

1. upload administrativo de layout em `src/app/pedidos/actions.ts`, após
   `orders.create` ou `orders.update`;
2. convite de usuário em `src/app/configuracoes/usuarios/actions.ts`, após
   `users.manage`.

Consultas, páginas, APIs, mutações comuns, alterações de papéis e alterações de
permissões usam a sessão do usuário e continuam sujeitas a RLS.

## Validação HTTP da API

Em staging, teste `/api/pedidos/<UUID>/grade` com três sessões:

- sem cookie: resposta `401`;
- usuário ativo sem `orders.view`: resposta `403`;
- usuário ativo com `orders.view` e pedido existente: resposta `200`.

Não salve cookies, access tokens, connection strings nem chaves nos arquivos do
repositório ou no histórico do terminal.

## Rollback operacional

Não reverta removendo as tabelas RBAC enquanto o código novo estiver publicado.
Em caso de falha em staging, interrompa o deploy da aplicação e restaure o banco
validado. Em produção, siga o runbook de restore; não recrie a policy ampla
`authenticated_access_baseline` como correção emergencial sem uma avaliação de
segurança explícita.
