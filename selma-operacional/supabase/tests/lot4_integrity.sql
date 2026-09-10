-- Testes preparados para staging/local DB. Executar com um usuário autenticado
-- que possua os papéis apropriados; este arquivo não foi executado remotamente.
begin;

DO $$ BEGIN
  IF to_regclass('public.payments') IS NULL THEN RAISE EXCEPTION 'payments não criada'; END IF;
  IF to_regclass('public.accounts_receivable') IS NULL THEN RAISE EXCEPTION 'accounts_receivable não criada'; END IF;
  IF to_regclass('public.pedido_number_seq') IS NULL THEN RAISE EXCEPTION 'sequence não criada'; END IF;
END $$;

SELECT has_permission('orders.create') AS orders_permission;
SELECT has_permission('finance.update') AS finance_permission;

-- Concorrência: executar em duas sessões simultâneas e confirmar números distintos.
SELECT next_order_number();
SELECT next_order_number();

-- Idempotência: a segunda chamada com a mesma chave deve retornar o mesmo id.
-- Substitua os UUIDs pelos registros do fixture de staging.
-- SELECT record_payment('<order-uuid>', 1.00, 'pix', current_date, NULL, NULL, '<operation-uuid>');
-- SELECT record_payment('<order-uuid>', 1.00, 'pix', current_date, NULL, NULL, '<operation-uuid>');

ROLLBACK;
