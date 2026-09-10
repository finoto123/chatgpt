# Lote 8 — Inteligência Operacional para Confecção

Status remoto: **AGUARDANDO HOMOLOGAÇÃO**. Nenhuma migration deste lote foi aplicada no Supabase real durante a implementação.

## Ordem obrigatória

1. Confirmar que os Lotes 6.5 e 7 estão homologados e fazer backup do banco de staging.
2. Aplicar `202609100001_art_and_technical_sheet.sql`.
3. Aplicar `202609100002_material_planning.sql`.
4. Aplicar `202609100003_purchasing.sql`.
5. Aplicar `202609100004_production_capacity.sql`.
6. Executar `supabase/tests/lot8_operational_intelligence.sql`. O teste abre transação e termina com `ROLLBACK`.
7. Executar os cenários autenticados abaixo com perfis de Produção, Compras, Comercial e um usuário sem permissões operacionais.

Nunca reaplique uma migration registrada. As quatro migrations foram separadas para que cada domínio possa ser validado antes do seguinte.

## Cenário ponta a ponta

1. Abra um pedido confirmado com itens e crie a primeira versão de arte usando PNG, JPG, WebP ou PDF válido.
2. Gere o link público. Em uma janela anônima, confirme que aparecem apenas cliente, pedido, item e especificação da arte.
3. Abra o mesmo link novamente em menos de cinco minutos e confira que a contagem não infla. Solicite alteração; confirme notificação interna, bloqueio do pedido e inutilização do token anterior depois da nova versão.
4. Envie a nova versão e aprove como cliente. Confirme data, nome e auditoria.
5. Salve uma ficha técnica para cada item. Edite uma ficha e confira que a versão anterior virou `superseded` sem ser sobrescrita.
6. Cadastre a BOM com quantidade por peça e perda. Confira `required_quantity = quantidade do pedido × consumo unitário × (1 + perda/100)`.
7. Reserve os materiais. Rode a operação de novo e confirme que não duplica a reserva. Use dois pedidos concorrentes para o mesmo tecido e confirme que a soma reservada nunca supera o estoque físico.
8. Para uma falta, abra Compras, escolha o fornecedor e gere o pedido. Marque como enviado e confirmado.
9. Faça um recebimento parcial e repita a mesma chamada com o mesmo `operation_id`; confirme um único recebimento e uma única entrada no ledger. Receba o restante e confira status `received`.
10. Recalcule o plano. Confira rota, filas, capacidade, feriados, margem de segurança, primeira data segura, risco e explicação.
11. Tente liberar o pedido com arte, ficha, BOM, reserva ou plano pendente; cada gate deve bloquear no servidor. Conclua os gates e libere.
12. Se a data comprometida anteceder a segura, informe justificativa. Quando a configuração exigir aprovação de alto risco, valide também um usuário que não seja gerente.
13. Altere quantidade, item ou arte depois da liberação. O plano deve ficar bloqueado, a liberação deve ser removida e as reservas afetadas devem ser liberadas.

## Segurança e concorrência

- `anon` não recebe acesso direto às tabelas. A aprovação pública usa somente RPCs com token aleatório armazenado como SHA-256, expiração e invalidação por versão.
- O DTO público não contém custo, lucro, margem, notas internas, tokens, auditoria ou dados de outros pedidos.
- Uploads usam o bucket privado `pedidos-layouts`, validação de extensão, MIME, assinatura mágica e tamanho no servidor.
- Reservas bloqueiam pedido e tecido com `FOR UPDATE`; a restrição parcial impede duas reservas ativas para a mesma linha de BOM.
- Recebimentos usam `operation_id` único. Consumo de reserva mantém uma única movimentação por reserva.
- Toda RPC `SECURITY DEFINER` fixa `search_path`; operações internas exigem `auth.uid()` e permissão.

## Rollback de homologação

Como o lote adiciona dados relacionados a pedidos, não remova objetos em produção sem exportar artes, fichas, BOMs, reservas, compras e planos. Em staging descartável, reverta na ordem inversa: triggers e views, funções, tabelas de planejamento, compras, materiais, arte e por último as colunas adicionadas a `pedidos` e `tecidos`.

## Critério de aprovação

Homologue somente quando lint, typecheck, testes, build e audit estiverem verdes; o SQL transacional passar; os quatro perfis respeitarem suas permissões; o fluxo público funcionar em celular; e Pedido 360, PCP e Compras funcionarem em tablet e desktop sem dados fictícios.
