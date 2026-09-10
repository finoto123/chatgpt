# Backup e restauração do Supabase

Este runbook deve ser executado **antes de qualquer migração remota**. O repositório não contém credenciais, referência do projeto nem dump do banco; portanto, nenhum backup remoto foi executado durante o Lote 1.

## 1. Identificar e separar os ambientes

1. No painel do Supabase, registre o `Project Ref`, região e plano do projeto de produção.
2. No provedor de deploy, confira as variáveis de **Production**, **Preview** e **Development**. Cada ambiente deve apontar para um projeto Supabase diferente.
3. Se staging ainda não existir, crie um projeto separado. Nunca use o banco de produção em deploys de preview.
4. Em Authentication > URL Configuration, cadastre a URL de produção e as URLs de desenvolvimento/staging permitidas.
5. Em Authentication > Providers, habilite Email/Password. Não habilite cadastro público neste lote; crie os usuários internos pelo painel.

Registre os identificadores fora do Git, no cofre de segredos da equipe:

| Ambiente | Project Ref | URL da aplicação | Responsável | Data conferida |
|---|---|---|---|---|
| Produção | preencher | preencher | preencher | preencher |
| Staging | preencher | preencher | preencher | preencher |

## 2. Backup lógico do banco

Pré-requisitos: Supabase CLI, Docker Desktop em execução, cliente `psql` e a connection string do **Session pooler** exibida em Project > Connect. A senha ou URL completa nunca deve entrar no repositório nem no histórico do terminal.

Crie uma pasta fora do repositório ou use `backups/` localmente (essa pasta está no `.gitignore`). Em PowerShell, substitua os marcadores e execute cada comando separadamente:

```powershell
New-Item -ItemType Directory -Force backups\producao-AAAA-MM-DD

supabase db dump --db-url "<CONNECTION_STRING_PRODUCAO>" -f backups\producao-AAAA-MM-DD\roles.sql --role-only
supabase db dump --db-url "<CONNECTION_STRING_PRODUCAO>" -f backups\producao-AAAA-MM-DD\schema.sql
supabase db dump --db-url "<CONNECTION_STRING_PRODUCAO>" -f backups\producao-AAAA-MM-DD\data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

Get-FileHash backups\producao-AAAA-MM-DD\roles.sql -Algorithm SHA256
Get-FileHash backups\producao-AAAA-MM-DD\schema.sql -Algorithm SHA256
Get-FileHash backups\producao-AAAA-MM-DD\data.sql -Algorithm SHA256
```

Confirme que os três arquivos existem, têm tamanho maior que zero e guarde os hashes junto ao backup. Armazene uma cópia criptografada fora da máquina de desenvolvimento.

O dump padrão exclui schemas gerenciados, como `auth` e `storage`. Caso existam customizações nesses schemas, capture o diff antes da migração:

```powershell
supabase link --project-ref "<PROJECT_REF_PRODUCAO>"
supabase db diff --linked --schema auth,storage -o backups\producao-AAAA-MM-DD\auth-storage-changes.sql
```

## 3. Backup dos arquivos do Storage

O backup do banco guarda metadados de Storage, mas **não guarda os arquivos**. Para o bucket `pedidos-layouts`:

1. No painel, abra Storage > Configuration > S3 e gere credenciais temporárias.
2. Use um cliente compatível com S3 (por exemplo, rclone ou Cyberduck) para baixar recursivamente o bucket.
3. Gere um manifesto com caminho, tamanho e hash de cada objeto.
4. Revogue as credenciais S3 temporárias após a cópia.
5. Compare a quantidade de objetos do manifesto com a quantidade exibida no bucket.

## 4. Teste de restauração

Restaure primeiro em um projeto Supabase novo e descartável. Nunca valide um restore sobrescrevendo produção.

```powershell
psql --single-transaction --variable ON_ERROR_STOP=1 --file backups\producao-AAAA-MM-DD\roles.sql --file backups\producao-AAAA-MM-DD\schema.sql --file backups\producao-AAAA-MM-DD\data.sql --dbname "<CONNECTION_STRING_RESTORE_TESTE>"
```

Depois:

1. Aplique, se necessário, `auth-storage-changes.sql` após revisar cada comando.
2. Reenvie os objetos de Storage para o bucket de teste.
3. Compare contagens das tabelas operacionais e hashes do manifesto de arquivos.
4. Crie um usuário de teste no Auth e valide login, leitura e uma escrita reversível.
5. Registre data, responsável, duração e resultado do teste.

## 5. Ordem segura para publicar o Lote 1

1. Concluir e verificar os backups de banco e Storage.
2. Restaurar e validar o backup em projeto separado.
3. Revisar a migração `202609060001_authenticated_access_baseline.sql` contra o schema real.
4. Aplicar primeiro em staging e executar o checklist de autenticação.
5. Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` em cada ambiente.
6. Criar os usuários internos pelo painel do Supabase.
7. Somente após aprovação em staging, agendar a aplicação em produção.

## 6. Plano de rollback

- Antes do deploy, registre o commit anterior e mantenha-o disponível para rollback da aplicação.
- Se a migração falhar, não improvise alterações no SQL Editor: interrompa a publicação e restaure no projeto de teste para reproduzir o problema.
- Se houver perda ou corrupção de dados, coloque a aplicação em manutenção e restaure pelo painel (backup/PITR, quando disponível) ou pelo dump lógico verificado.
- A restauração pelo painel pode causar indisponibilidade; comunique a janela antes de confirmar.

Referências oficiais:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/storage/management/download-objects
