-- ============================================================
-- MIGRAÇÃO: Adiciona coluna observacao em itens_pedido
-- O formulário coleta observação por item, mas a coluna não existia.
-- Execute no Supabase SQL Editor.
-- ============================================================

ALTER TABLE itens_pedido
  ADD COLUMN IF NOT EXISTS observacao TEXT;
