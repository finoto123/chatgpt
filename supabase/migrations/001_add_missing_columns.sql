-- ============================================================
-- MIGRAÇÃO: Adiciona colunas usadas pelo código mas ausentes no banco
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Colunas faltando na tabela pedidos
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS etapas_ativas         TEXT[]         DEFAULT ARRAY['corte','costura'],
  ADD COLUMN IF NOT EXISTS sublimacao_programado DATE,
  ADD COLUMN IF NOT EXISTS sublimacao_retorno    DATE,
  ADD COLUMN IF NOT EXISTS estampa_oficina_id    UUID           REFERENCES oficinas(id),
  ADD COLUMN IF NOT EXISTS cliente_id            UUID,
  ADD COLUMN IF NOT EXISTS valor_pago_adicional  NUMERIC(10,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_pagamento      TEXT           DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS layout_pdf_url        TEXT,
  ADD COLUMN IF NOT EXISTS bordado_status        TEXT,
  ADD COLUMN IF NOT EXISTS bordado_inicio        DATE,
  ADD COLUMN IF NOT EXISTS bordado_fim           DATE,
  ADD COLUMN IF NOT EXISTS bordado_obs           TEXT;

-- 2. Constraint de status_pagamento
ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_status_pagamento_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_status_pagamento_check
  CHECK (status_pagamento IN ('pendente','parcial','pago'));

-- 3. Atualiza constraint de status do pedido para incluir novos valores
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
  CHECK (status IN (
    'rascunho',
    'aguardando_corte',
    'corte',
    'estamparia',
    'sublimacao',
    'dtf',
    'bordados',
    'costura',
    'acabamento',
    'entregue',
    'atrasado',
    'cancelado'
  ));

-- 4. Tabela clientes (usada por cliente_id em pedidos)
CREATE TABLE IF NOT EXISTS clientes (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT    NOT NULL,
  contato      TEXT,
  email        TEXT,
  cidade       TEXT,
  observacoes  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'allow_all'
  ) THEN
    EXECUTE 'CREATE POLICY "allow_all" ON clientes FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 5. FK cliente_id → clientes (só após garantir que a tabela existe)
ALTER TABLE pedidos
  DROP CONSTRAINT IF EXISTS pedidos_cliente_id_fkey;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id);
