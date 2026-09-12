# APP-1 — Runtime único Selma + Comercial

Data: 12/09/2026
Status: **✅ APP COMPLETA · 🧪 BANCO REAL**

## 1. Arquitetura anterior

Selma e Deskcomm eram tratados como aplicações distintas, com possibilidade de
dois processos, dois logins, cookies separados, proxy/base path e domínios
duplicados. Esse desenho criava split brain entre comercial e operação.

## 2. Arquitetura resultante

`selmabordados-1` é a aplicação Next.js canônica. O comercial é um namespace
interno em `/comercial`, protegido pela mesma sessão e pelo mesmo RBAC da Selma.
Dashboard, CRM, atendimento e operação são compilados e servidos pelo mesmo
processo.

## 3. Módulos Deskcomm autorizados

Permanecem no plano de incorporação: atendimento, Inbox, WhatsApp, conversations,
messages, attachments, realtime abstrato, filas, assignment, transfer, handoff,
templates, channel adapters, automação conversacional e IA de atendimento.

## 4. Entrega efetiva da APP-1

- manifesto arquitetural executável do runtime comercial;
- mapa único de rotas comerciais;
- Inbox responsiva de três painéis dentro da Selma;
- busca e filtros de fila, minhas e fechadas;
- conversa, oportunidade e contexto de pedido Selma somente leitura;
- navegação interna para `/crm`;
- fixtures tipadas, sem chamadas externas e sem writes;
- controles de envio, anexo e assignment explicitamente desabilitados até APP-8.

## 5. Módulos descartados como fonte de verdade Deskcomm

Pedidos, orçamento, proposta, arte, ficha técnica, BOM, produção, PCP, estoque,
compras, financeiro e fiscal não serão portados como domínios Deskcomm. A Selma
continua sendo a única fonte de verdade desses domínios.

## 6. Arquivos criados

- `src/features/commercial/runtime-manifest.ts`
- `src/features/commercial/inbox/fixtures.ts`
- `src/features/commercial/inbox/CommercialInbox.tsx`
- `src/app/comercial/app/inbox/page.tsx`
- `docs/DATABASE-DEFERRED-PLAN.md`
- `docs/APP-1-RUNTIME-UNICO.md`

## 7. Arquivos alterados

- `src/lib/integration/commercial-route-map.ts`
- `src/lib/integration/single-application.test.mjs`
- `src/app/comercial/app/[...slug]/page.tsx`
- `docs/A1-REPRODUCIBLE-STATE.md`
- `docs/ARCHITECTURE-SELMA-DESKCOMM.md`
- `docs/FUNCTIONAL-BENCHMARK.md`
- `docs/MASTER-FIX-PLAN.md`

## 8. Dependências

Nenhuma dependência foi adicionada, atualizada ou removida na APP-1.

## 9. Runtime e sessão

- processo canônico: `selmabordados-1`;
- framework: Next.js 16.3.4;
- login canônico: `/login`;
- sessão: Supabase Auth Selma;
- namespace comercial: `/comercial`;
- segundo runtime/login/cookie: não existe no desenho final.

## 10. Base path e proxy

Não há `basePath`, `assetPrefix`, rewrite para Deskcomm nem variável
`DESKCOMM_COMMERCIAL_ORIGIN`. As páginas e assets comerciais pertencem ao mesmo
build Selma.

## 11. APIs e providers

A APP-1 não adiciona API de escrita. A Inbox lê fixtures locais. Contratos e
providers de dados serão fechados na APP-5; messaging, attachments, WhatsApp,
assignment e realtime serão ligados na APP-8.

## 12. Operação preservada

Rotas de pedidos, produção, corte, bordado, DTF, sublimação, oficinas,
acabamento, estoque, compras, financeiro, cadastros e configurações continuam no
mesmo menu e no mesmo build. O módulo comercial não expõe ações de fábrica.

## 13. Segurança conceitual

A página da Inbox exige `crm.view` no servidor. Esconder item de menu não é usado
como controle de acesso. A matriz completa de Auth/RBAC será concluída na APP-2.

## 14. Verificação automatizada

- lint: aprovado, zero erro e zero warning;
- typecheck: aprovado;
- testes: 102/102 aprovados;
- integração de aplicação única: 9/9;
- build de produção: aprovado, incluindo `/comercial/app/inbox` e rotas
  operacionais.

## 15. Verificação visual local

Em `http://localhost:3001/comercial/app/inbox`, foi confirmado:

- menu único “Comercial + Operacional”;
- Inbox de três painéis em desktop;
- filtros funcionais;
- ações futuras desabilitadas e identificadas;
- link “Abrir CRM Selma” navegando para `/crm` no mesmo host;
- ausência de segundo login durante a navegação autenticada.

## 16. Banco e integrações reais pendentes

Nenhum banco recebeu alteração. Permanecem para o Track DB: schema definitivo,
migrations, Auth/RLS homologados, Storage, Realtime, índices, constraints,
backup/restore, concorrência, migração de dados e E2E real. WhatsApp/WAHA/Meta e
secrets também não foram ativados.

## 17. Limites desta aprovação

“APP completa” significa que o objetivo arquitetural e a superfície local da
APP-1 estão prontos e passam os gates de código. Não significa que atendimento
real, banco, mensageria ou integrações externas estejam homologados.

## 18. Próxima fase

APP-2 — Auth/RBAC arquitetural. A execução deve começar somente após autorização
do usuário. Nenhuma etapa do Track DB deve ser antecipada.
