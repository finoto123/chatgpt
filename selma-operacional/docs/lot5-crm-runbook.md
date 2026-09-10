# Lote 5 — CRM comercial

Status: **MIGRATION E TESTES SQL HOMOLOGADOS**.

Em 08/09/2026, o usuário confirmou a execução bem-sucedida da migration e de `supabase/tests/lot5_crm.sql` no Supabase real. A validação funcional das telas e dos fluxos por perfil ainda deve ser realizada.

## Escopo entregue

- contatos vinculados a clientes, origens, leads e conversão transacional;
- pipeline comercial com etapas, probabilidades, oportunidades e motivos de perda;
- atividades, tarefas, próxima ação e auditoria dos eventos de CRM;
- Kanban em `/crm`, leads em `/crm/leads`, oportunidade 360 em `/crm/oportunidades/[id]` e central em `/tarefas`;
- Cliente 360 com contatos, oportunidades, atividades e tarefas;
- busca global por clientes, pedidos, leads e oportunidades com `Ctrl/Cmd + K`;
- RLS por `crm.view`, `crm.create`, `crm.update` e `crm.delete`.

Clientes existentes são apenas referenciados. A migration não reescreve cadastros nem pedidos.
A detecção de duplicidade usa e-mail e telefones normalizados. CPF/CNPJ será incluído quando esses campos existirem no cadastro de clientes; nomes nunca são mesclados automaticamente.

As tabelas, policies e RPCs foram aplicadas com sucesso no Supabase real, e o teste SQL transacional foi concluído sem erros, conforme confirmação do usuário.

## Ordem de homologação

1. Criar backup lógico do banco de homologação.
2. Aplicar `supabase/migrations/202609080001_crm_foundation.sql` após os Lotes 1–4.
3. Executar `supabase/tests/lot5_crm.sql`.
4. Entrar com perfis administrador, gerente e vendedor e validar RLS e menus.
5. Criar lead, testar aviso de duplicidade e converter em cliente/contato/oportunidade.
6. Mover oportunidade no Kanban, registrar perda, ganho e reabertura por gerente.
7. Criar, reagendar, concluir e cancelar tarefas; conferir próxima ação e timeline.
8. Validar Cliente 360, busca global e auditoria.

## Validação local

```bash
npm run lint
npx tsc --noEmit
npm test
npm audit --omit=dev
npm run build
```

Depois da homologação aprovada, aplique a mesma migration em produção durante janela controlada e valide os mesmos fluxos. O Lote 6 não faz parte desta entrega.
