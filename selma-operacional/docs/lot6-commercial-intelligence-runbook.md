# Lote 6 — Inteligência Comercial e Gestão do Funil

Status: **AGUARDANDO HOMOLOGAÇÃO NO SUPABASE REAL**.

## Escopo entregue

A migration `202609080002_commercial_intelligence.sql` cria score configurável e explicável, temperatura automática com override, histórico de etapas, automações internas idempotentes, alertas persistentes, metas, visões salvas, Central Comercial, analytics, forecast e reativação de clientes. As automações criam apenas tarefas e notificações dentro do sistema.

## Ordem de homologação

1. Gere um backup do banco de produção.
2. Confirme que `202609080001_crm_foundation.sql` e `lot5_crm.sql` já passaram. Esse passo foi informado como concluído em 08/09/2026.
3. No SQL Editor do projeto Supabase, execute todo o arquivo `supabase/migrations/202609080002_commercial_intelligence.sql` em uma única execução.
4. Execute `supabase/tests/lot6_commercial_intelligence.sql`. O script termina com `ROLLBACK` e não mantém dados de teste.
5. Abra `/crm`, `/crm/funil`, `/crm/analytics`, `/crm/reativacao` e `/configuracoes/comercial` com um administrador.
6. Valide um vendedor comum: ele visualiza e opera sua rotina, mas não altera configurações, score, automações, metas ou cadastros do pipeline.

## Agendamento diário opcional

A função `public.run_commercial_daily_check()` foi preparada para execução com `service_role`. Se o projeto tiver Supabase Cron/`pg_cron` habilitado, agende uma execução diária às 08:15 de São Paulo (11:15 UTC):

```sql
select cron.schedule(
  'commercial-daily-check',
  '15 11 * * *',
  $$select public.run_commercial_daily_check();$$
);
```

O índice único de `automation_runs.idempotency_key` impede a repetição da mesma regra para a mesma oportunidade e marco. A notificação de tarefa vencida também tem uma chave única por tarefa.

## Roteiro funcional

- Crie uma oportunidade e confirme score, explicação e temperatura automática.
- Altere a temperatura manualmente e depois retorne para “Automática”.
- Mova uma oportunidade para “Orçamento enviado” e confirme a criação de uma tarefa de follow-up.
- Arraste para “Ganho”; confirme que valor final e data são obrigatórios e aparecem na timeline.
- Arraste para “Perdido”; confirme motivo obrigatório, concorrente e observação.
- Confira prioridades, tarefas vencidas, oportunidades paradas e fechamentos próximos na Central.
- Confira funil, tempo por etapa, vendedores, origens, perdas, concorrentes, forecast e metas em Analytics.
- Gere tarefas em lote pela tela de Reativação e confirme que nenhuma mensagem externa foi enviada.
- Confirme os alertas do sino e a marcação de leitura.

## Ownership e métricas

O banco atual não possui responsável em `clientes`. Por isso este lote não aplica uma RLS parcial que faria clientes históricos desaparecerem. A carteira por vendedor considera clientes ligados às oportunidades daquele responsável; gerente e administrador podem consultar qualquer vendedor. Vendedores consultam sua própria Central e seus próprios recortes analíticos nas RPCs. A evolução para `clientes.owner_id`, com backfill e definição formal de equipes, fica preparada para uma migration futura.

As consultas da Central, analytics, forecast e reativação agregam no PostgreSQL e retornam JSON resumido. Não há materialized view nesta etapa. A conversão usa a coorte de oportunidades criadas no período; o tempo até o primeiro contato usa a primeira `activity` vinculada e fica vazio quando não há atividade confiável.

## Rollback

Não há rollback automático porque o lote adiciona dados comerciais. Em caso de falha antes do uso, restaure o backup. Para corrigir uma migration parcialmente aplicada, registre o erro exato e prepare uma migration aditiva; não apague tabelas com dados manualmente.

## Limites reservados

WhatsApp oficial, e-mail transacional, IA, automação de orçamento/proposta/pedido, forecast probabilístico avançado e demais integrações externas permanecem fora deste lote.
