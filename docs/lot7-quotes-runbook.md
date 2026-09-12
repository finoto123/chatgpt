# Lote 7 — Orçamentos e propostas

Status remoto: **AGUARDANDO HOMOLOGAÇÃO**.

## Ordem de aplicação

1. Fazer backup do banco de staging.
2. Aplicar `202609090001_payment_term_management.sql`.
3. Executar o smoke test autenticado das condições de pagamento e validar RLS/permissões.
4. Validar Central, Funil e Analytics e comparar as telas em 1920, 1440, 768 e 390 px.
5. Aplicar `202609080003_quotes_proposals.sql` caso ainda não conste no histórico do banco. A migration 6.5 agora cria `payment_term_templates` de forma autônoma, portanto esta ordem também funciona em um staging limpo.
6. Aplicar `202609090004_quote_professional_completion.sql`.
7. Executar `supabase/tests/lot7_quotes_proposals.sql`; o arquivo abre uma transação e termina com `ROLLBACK`.

Nunca reaplique uma migration que já esteja registrada no ambiente. Se `202609080003_quotes_proposals.sql` já tiver sido aplicada, execute somente a migration complementar do Lote 7 depois do gate 6.5.

## Smoke test autenticado

- Entrar como vendedor e criar o orçamento pela Opportunity 360.
- Salvar um item com grade e confirmar que a soma diferente da quantidade é recusada.
- Salvar um custo manual e conferir `cost_set_by` e `cost_set_at`.
- Forçar desconto acima do limite ou margem abaixo da política; confirmar que o envio é bloqueado até a decisão de um usuário com `quotes.approve`.
- Enviar v1, abrir a proposta pública no celular, recarregar em menos de cinco minutos e conferir que uma única visualização significativa foi contada.
- Solicitar alteração, salvar a edição e confirmar que v2 foi criada sem alteração da v1 e que o token da v1 informa versão mais recente.
- Aprovar v2, confirmar a etapa `waiting_deposit`, converter e conferir um único pedido, seus itens/grade e as parcelas em `accounts_receivable`.
- Confirmar que nenhuma linha foi criada em `payments`.

## Rollback e concorrência

Em staging, crie temporariamente um trigger `BEFORE INSERT` em `accounts_receivable` que lance uma exceção para o pedido de teste. Execute `convert_quote_to_order` e confirme que não existem `pedidos`, `itens_pedido`, recebíveis ou alteração de status para a quote usada. Remova o trigger dentro da mesma sessão de homologação.

Para idempotência, dispare duas chamadas concorrentes de `convert_quote_to_order` para o mesmo orçamento aprovado. As duas respostas devem apontar para o mesmo `order_id`, e `pedidos_source_quote_unique_idx` deve garantir uma única linha em `pedidos`.

## Segurança pública

Teste token inválido, expirado, revogado, versão antiga, resposta repetida e proposta convertida. A RPC pública deve retornar somente o DTO da proposta, sem custo, lucro, margem, markup, notas internas, aprovações, auditoria ou dados de outra proposta.
