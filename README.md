# Selma Bordados — Comercial + Operacional

Aplicação unificada de gestão comercial e operacional da Selma Bordados.
CRM, Inbox comercial, pedidos, produção, estoque, compras e financeiro são
entregues pelo mesmo projeto Next.js, com um único login e uma única sessão.

## Requisitos

- Node.js 22
- npm
- projeto Supabase configurado

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha as variáveis do seu ambiente Supabase.
3. Instale as dependências:

```bash
npm ci
```

4. Inicie o projeto:

```bash
npm run dev -- --port 3001
```

Acesse `http://localhost:3001/login`.

## Validação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Arquitetura

- `/login`: autenticação única;
- `/dashboard`: visão operacional;
- `/crm`: CRM Selma;
- `/comercial`: módulo comercial incorporado;
- `/comercial/app/inbox`: Inbox no mesmo runtime;
- `/pedidos`, `/producao`, `/estoque`, `/compras` e `/financeiro`: operação.

O banco atualmente usado no desenvolvimento é apenas referência. Não execute
migrations em ambiente real sem concluir o Track DB e sua homologação. Consulte
`docs/APP-1-RUNTIME-UNICO.md` e `docs/DATABASE-DEFERRED-PLAN.md`.

## Segurança

Arquivos `.env*`, dependências, builds, caches e backups locais não são
versionados. O repositório contém somente `.env.example`, sem credenciais reais.
