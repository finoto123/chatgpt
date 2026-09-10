# Lote 4 — estabilização do núcleo operacional

## Estado de homologação

AGUARDANDO HOMOLOGAÇÃO. Este workspace não possui `SUPABASE_URL`, `project ref`,
connection string ou credenciais de staging. Nenhuma migration foi aplicada em
um banco remoto. Antes da aplicação, executar o backup/restore descrito em
`docs/backup-restore-supabase.md` e o checklist de `supabase/tests/lot4_integrity.sql`.

## Mudanças

- `202609070002_order_finance_integrity.sql` cria a sequence concorrente de pedidos,
  índice/constraints seguros, ledger `payments`, `accounts_receivable`,
  `payment_allocations`, migração legada identificada e RPCs protegidas:
  `next_order_number`, `create_order_with_items`, `update_order_with_items`,
  `record_payment`, `reverse_payment` e `record_inventory_movement`.
- Criação/edição de pedido, registro de pagamento e movimentação de estoque nas
  Server Actions chamam as RPCs transacionais. Falhas fazem rollback no PostgreSQL.
- `src/lib/business-date.ts` padroniza datas de negócio em `America/Sao_Paulo`.
- `src/lib/domain/orders/status.ts` centraliza estados, atraso derivado e quantidade
  de peças; `src/lib/domain/finance/calculations.ts` centraliza total, recebido,
  saldo e situação de pagamento.
- A tela de pedido lista pagamentos confirmados e calcula saldo a partir do ledger,
  preservando fallback dos campos legados.

## Compatibilidade e dados legados

`cliente_id`, número, entrada e saldo legado permanecem no schema. A migration
cria um payment `legacy/migrated_balance` por pedido apenas quando há valor positivo
e nenhum lançamento legado; correspondências ambíguas de clientes não são alteradas.
Duplicidades de número ou valores negativos impedem a criação automática do índice/
constraint e geram warning para revisão manual.

## Validação local

- `npm run lint`: OK
- `npx tsc --noEmit`: OK
- `npm test`: OK (auth, RBAC, autorização, segurança, datas e finanças)
- `npm audit --omit=dev`: 0 vulnerabilidades conhecidas
- `npm run build`: OK

## Pendente em staging

Aplicar migrations dos Lotes 1–4, testar login/RBAC/RLS por papel, auditoria,
Storage privado/signed URLs, rollback de criação/edição, duas criações concorrentes,
idempotência de pagamento, estorno, saída concorrente de estoque e fluxo E2E.
