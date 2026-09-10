# Selma Bordados integrado

Este repositório reúne o sistema operacional da Selma Bordados e o módulo
comercial baseado no DeskcommCRM.

## Estrutura

- `selma-operacional`: dashboard, pedidos, produção, estoque, compras,
  financeiro, cadastros e administração.
- `comercial-deskcomm`: atendimento, Inbox, Radar, Agenda, CRM, agentes de IA,
  canais, análise e configurações comerciais.

Em desenvolvimento, o Selma roda em `http://127.0.0.1:3100` e encaminha a zona
`/comercial` para o Deskcomm em `http://127.0.0.1:3200/comercial`.

## Instalação

1. Copie os dois arquivos `.env.example` para `.env.local` dentro de cada
   aplicação e preencha as configurações do Supabase.
2. Na raiz, execute `npm install`.
3. Execute `npm run install:all`.
4. Execute `npm run dev`.

Nenhuma credencial real é versionada neste repositório.

## Banco comercial

O código do Deskcomm requer seu próprio conjunto de tabelas, funções, políticas
RLS e buckets. Antes de aplicar o baseline em um banco Selma existente, faça um
backup completo e trate as colisões conhecidas em `contacts` e
`automation_rules`. Consulte
`selma-operacional/docs/deskcomm-commercial-integration.md`.

## Licença do módulo importado

O código comercial deriva do DeskcommCRM no commit
`1c9a46a180835cd21bcd74a732fba085df8f3e13`. Os avisos de licença correspondentes
estão preservados em `comercial-deskcomm/THIRD_PARTY_LICENSES`.
