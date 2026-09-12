# Plano Master de Correção — Selma Bordados + DeskcommCRM

Data: 11/09/2026
Fonte: `MASTER-SYSTEM-AUDIT.md`
Status: **A1-APP aprovado; APP-1 concluída; banco real deferido até APP-15**.

Registro da execução: `A1-REPRODUCIBLE-STATE.md`.

## Estratégia vigente: aplicação primeiro

O banco atualmente conectado é somente modelo, referência read-only e suporte visual/funcional. Ele não é o banco definitivo. A ausência de staging, baseline ou homologação PostgreSQL não bloqueia mais o desenvolvimento da aplicação.

Status oficial adicional: **🧪 IMPLEMENTADO — AGUARDANDO BANCO REAL**. Ele é usado quando UI, regra, service, contrato, mock e testes de aplicação estão prontos, mas ainda falta homologação no PostgreSQL/Supabase definitivo. `✅ VALIDADO` continua proibido quando a prova depende do banco real.

### Track A — Aplicação, executar agora

1. APP-1 Runtime único
2. APP-2 Auth/RBAC arquitetural
3. APP-3 Modelo de domínio único
4. APP-4 Bridge Selma/Deskcomm
5. APP-5 APIs e contratos
6. APP-6 CRM/Comercial
7. APP-7 Quotes/Propostas
8. APP-8 Atendimento
9. APP-9 PCP avançado
10. APP-10 Financeiro avançado
11. APP-11 BI
12. APP-12 IA
13. APP-13 Fiscal abstraction
14. APP-14 Alertas/Pós-venda
15. APP-15 QA completo

### Track DB — Banco real, executar somente depois

1. DB-1 Modelo definitivo
2. DB-2 Schema
3. DB-3 Migrations
4. DB-4 Auth/RLS
5. DB-5 Storage/Realtime
6. DB-6 Migração de dados
7. DB-7 Performance/índices
8. DB-8 Backup/restore
9. DB-9 E2E real
10. DB-10 Go-live

As pendências históricas de banco foram preservadas em `DATABASE-DEFERRED-PLAN.md`. As fases antigas abaixo continuam como rastreabilidade e foram remapeadas para os dois tracks; não definem mais bloqueio sequencial por banco.

## Regras de execução

1. Não aplicar DDL, seeds ou testes mutantes no banco operacional real nem nos bancos tratados como referência.
2. Criar um staging isolado e descartável antes da primeira alteração de integração.
3. Congelar o código por commits identificáveis; não homologar uma árvore Git suja.
4. Manter Selma como aplicação principal e fonte dos domínios de orçamento, proposta, pedido, produção, financeiro, estoque, compras, arte, PCP e fábrica.
5. Incorporar do Deskcomm apenas atendimento, Inbox, WhatsApp, conversations, messages, realtime, filas, assignment, handoff e automação conversacional necessária.
6. Nenhuma fase avança enquanto seu gate estiver vermelho.
7. Toda migration precisa de backup, dry run, teste de install/update, rollback documentado e registro em ledger canônico.
8. Nenhum “arquivo existe” substitui teste ponta a ponta.

## Estado-alvo

```text
Browser
  └─ Selma Next.js (único processo e domínio)
       ├─ /login (uma sessão Supabase Auth)
       ├─ RBAC Selma (um catálogo de permissions)
       ├─ /comercial
       │    ├─ Inbox / WhatsApp / conversations / messages
       │    ├─ queues / assignment / handoff / realtime
       │    └─ CRM comercial escolhido como fonte única
       ├─ /crm/orcamentos e /proposta (domínio Selma)
       └─ operação Selma preservada
            ├─ pedidos / produção / etapas fabris
            ├─ estoque / compras / financeiro
            └─ arte / ficha / BOM / PCP

Banco de staging único ou schemas explicitamente isolados
  ├─ identidade e autorização canônicas
  ├─ domínio comercial incorporado
  ├─ domínio operacional Selma
  └─ commercial_entity_links + bridge auditável
```

## FASE A — P0

Objetivo: eliminar split brain e tornar o fluxo central tecnicamente possível sem arriscar a operação existente.

### A1-APP. Congelar e reproduzir o estado de código — ✅ APROVADO

- Definir os commits-base de Selma e Deskcomm.
- Separar alterações locais por origem e intenção; não misturar implementação anterior com correções novas.
- Gerar manifestos de rotas, testes, migrations, tabelas, functions, policies, triggers e buckets a partir dos commits-base.
- Registrar versões de Node/npm/pnpm/Supabase CLI/Postgres.
- Criar backup somente leitura dos schemas de referência e validar restauração em ambiente descartável.

Gate:

- checkout limpo e reproduzível;
- builds reproduzíveis;
- inventários anexados ao release;
- nenhuma dependência do banco real para rodar testes.

Resultado: commits-base, delta, versões e fingerprints foram registrados. O snapshot externo preservou 5.464 arquivos, passou em hash e restore dry-run, e a Supabase CLI `2.117.0` ficou disponível de forma isolada. O estado de código reproduzível está aprovado. Ver `A1-REPRODUCIBLE-STATE.md`.

### A1-DB / DB-1. Banco definitivo e staging — ⏸ DEFERIDO

Estado: **deferido por decisão do produto**. Não criar staging agora, não reconstruir baseline legado e não corrigir ledger do banco de referência. Os ledgers já consultados permanecem evidência read-only; nenhum projeto recebeu writes.

- Subir Postgres/Supabase local ou novo projeto Supabase exclusivo de staging.
- Nunca reutilizar `zask...` ou `fzb...` como alvo automático enquanto forem apenas referência.
- Criar usuários de teste para os oito papéis Selma e papéis de atendimento necessários.
- Usar chaves e webhooks exclusivos de staging.
- Habilitar logs e correlação por request/operation id.

Gate:

- reset/seed repetível;
- testes podem criar e excluir dados sem tocar referências;
- prova do project ref usada em cada comando;
- secrets não aparecem em logs ou repositório.

### APP-1. Decidir e implementar o runtime único — ✅ APP COMPLETA · 🧪 BANCO REAL

- O processo web canônico deve ser `selmabordados-1`.
- Selecionar, arquivo a arquivo, os módulos Deskcomm autorizados a serem portados.
- Remover a dependência arquitetural de um segundo servidor para `/comercial`.
- Assets, Server Actions, route handlers e páginas comerciais devem compilar no mesmo Next.js.
- Substituir placeholders somente quando a função real estiver integrada; enquanto isso, rotular explicitamente “indisponível em staging”.

Gate:

- um único `npm run build` produz operação e atendimento;
- apenas um processo atende `/login`, `/dashboard`, `/comercial` e APIs;
- nenhum proxy externo ou segundo login é necessário;
- nenhuma rota operacional perde compilação.

Resultado: `selmabordados-1` é o único runtime; `/login`, `/dashboard`,
`/comercial` e a operação são entregues pelo mesmo Next.js, sem proxy, segundo
servidor, segundo cookie ou segundo login. A Inbox de três painéis foi portada
como superfície local responsiva com fixtures tipadas e contexto Selma somente
leitura. Providers, writes, WhatsApp e realtime ficam para APP-5/APP-8 e banco
real. Evidências e inventário: `APP-1-RUNTIME-UNICO.md`.

### A4. Unificar Auth, cookies e RBAC

- Usar uma sessão Supabase Auth canônica.
- Descontinuar `sb-deskcomm-auth` no runtime final.
- Mapear funções Deskcomm para permissions Selma explícitas; não inferir equivalência por nome de papel.
- Proteger páginas, Server Actions, route handlers, realtime tokens e uploads no servidor.
- Definir comportamento para usuário inativo, usuário sem organização e suporte/impersonation.

Gate:

- login único abre módulos permitidos;
- usuário inativo é bloqueado;
- anon recebe 401; autenticado sem permission recebe 403;
- esconder item de menu não é a única proteção;
- oito papéis Selma passam matriz positiva e negativa.

### A5. Definir o modelo de dados único e ledger de migrations

- Escolher fonte de verdade para cliente/contato, lead, oportunidade, pipeline, tarefa e automação.
- Preservar `pedidos` Selma; proibir uso de `Deskcomm.orders` como pedido fabril.
- Resolver colisões `contacts`, `automation_rules`, `crm_*` e `ai_knowledge_versions` por rename/schema/adaptação explícita.
- Gerar baseline verificável a partir de staging limpo.
- Corrigir `db:migrate` para executar e registrar migrations de verdade.
- Garantir nomes/ordem únicos de migration.

Gate:

- instalação do zero e atualização de uma versão anterior terminam sem erro;
- ledger remoto contém exatamente o conjunto aplicado;
- schema diff após segunda aplicação é vazio;
- nenhuma tabela operacional é substituída.

### A6. Implementar bridge e mappings

- Implementar adapter concreto do `SelmaOperationalGateway`.
- Criar `commercial_entity_links` ou mecanismo equivalente com UUIDs, organização, unicidade, timestamps e RLS.
- Operações permitidas: localizar/criar cliente de forma controlada, criar/ler orçamento, listar/ler pedido Selma.
- Atendimento deve ser somente leitura para número/status/prazo de pedido e nunca expor ações de produção.
- Todas as writes precisam de autorização, audit log e idempotency key.

Gate:

- WhatsApp → mensagem → conversation → contato → lead/oportunidade → orçamento Selma → proposta → pedido Selma passa em staging;
- o Inbox consulta `pedidos`, não `orders`;
- repetição não duplica cliente, contato, orçamento ou pedido;
- usuário de atendimento não movimenta estoque/produção/financeiro.

### A7. Resolver base path e contratos de API

- No runtime único, escolher uma convenção definitiva para API: raiz ou namespace comercial.
- Encapsular todas as chamadas internas em um helper único ou usar URLs relativas compatíveis com o runtime final.
- Eliminar os 28 `fetch('/api/...')` não compatíveis ou eliminar a necessidade do base path, conforme arquitetura final.
- Cobrir mídia, uploads, service worker, realtime auth, webhooks e redirects.

Gate:

- zero teste divergindo entre `/api` e `/comercial/api`;
- varredura estática sem chamada proibida;
- todas as 254 rotas necessárias têm consumidor correto ou foram descartadas conscientemente;
- Inbox envia/recebe mídia sob o mesmo host e sessão.

### A8. Gate P0 completo

- Selma: lint, typecheck, unit, SQL, build e audit verdes.
- Código Deskcomm incorporado: testes selecionados e adaptados verdes.
- DB install/update/invariants verdes em staging descartável.
- E2E golden path único verde.
- Concorrência/idempotência central verde.
- Backup/rollback ensaiados.

Somente após A8 considerar qualquer release candidato.

## FASE B — P1

Objetivo: tornar os módulos importantes confiáveis e fechar falhas que impedem homologação.

### B1. Reparar o gate de testes Deskcomm

- Corrigir as 28 falhas, separando defeitos de produto de incompatibilidades do harness Windows.
- Corrigir leitura duplicada de response body.
- Corrigir timeouts determinísticos e evitar simplesmente aumentar timeout sem causa.
- Tornar verificadores shell portáveis ou executá-los em ambiente Linux oficial.
- Fechar falhas de i18n, namespace de imagens e Tailwind.

Gate: `pnpm test:unit` com 0 falha e resultado reproduzível em CI.

### B2. Homologar Auth/RBAC/RLS

- Executar SQL de catálogo e integração RBAC.
- Testar último administrador, bootstrap, alteração de papel e acesso cruzado.
- Triar cada tabela RLS sem policy como “intencionalmente inacessível” ou “policy ausente”.
- Triar cada `SECURITY DEFINER`: owner, `search_path`, grants, validação de `auth.uid`, tenant e permission.
- Testar proposta pública anon separadamente, incluindo rate limit.

Gate: matriz 401/403/200 e isolamento de tenant/domínio aprovada.

### B3. Homologar pedidos, financeiro e estoque

- Testar duas criações simultâneas de pedido e sequence.
- Testar create/update com falha induzida e rollback integral.
- Testar payment idempotente, alocação, estorno e saldo.
- Testar estoque concorrente e bloqueio de saldo negativo.
- Confirmar que recebível não cria pagamento fictício.

Gate: invariantes SQL e testes com duas conexões verdes.

### B4. Homologar CRM e inteligência comercial

- Testar deduplicação por telefone/WhatsApp/e-mail/CPF-CNPJ sem merge automático indevido.
- Testar `convert_lead` para cliente existente/novo e rollback.
- Testar Kanban/stage history/perda/concorrente/tarefas/próxima ação.
- Ativar cron somente em staging; provar idempotência e observabilidade.
- Verificar analytics com volume acima dos limites atuais e corrigir truncamentos.

Gate: fluxo cliente/lead/oportunidade/tarefa/stage e scheduler verde.

### B5. Homologar orçamento/proposta/quote-to-order

- Aplicar migrations em staging na ordem canônica.
- Testar grade, pricing, custo, margem, desconto e approvals por papel.
- Testar imutabilidade v1/v2 e snapshots.
- Testar token inválido/expirado/revogado/antigo/replay e não vazamento.
- Testar conversão concorrente e rollback com erro induzido em recebível.
- Confirmar exatamente um pedido e parcelas corretas, sem `payments` fictício.

Gate: Lote 7 SQL + E2E mobile/desktop + concorrência verdes.

### B6. Homologar atendimento

- Conectar WAHA em ambiente de teste e, se necessário, Meta sandbox.
- Testar inbound/outbound, ack/status, mídia, external id, replay e dedup.
- Testar 3 painéis do Inbox, assignment, transfer, queue e handoff.
- Testar realtime com duas sessões e refresh de token.
- Testar falhas de provedor, retry e reconciliação.

Gate: jornada Connection → Conversation → Message → Assignment → Reply → Realtime verde.

### B7. Segurança de dependências e segredo histórico

- Atualizar a árvore que prende `hono@4.13.1` para versão corrigida compatível.
- Rotacionar a credencial histórica documentada, mesmo que se acredite inativa.
- Remover a credencial de documentação corrente e avaliar limpeza de histórico conforme política do repositório.
- Configurar `IMPERSONATE_COOKIE_SECRET` forte ou desabilitar o recurso no build final.
- Configurar chaves IA somente se o módulo for parte do release.

Gate: audits sem vulnerabilidade conhecida aceita e scan de secrets limpo.

### B8. Rota `/corte`

- Decidir formalmente se corte é página independente ou etapa dentro de produção.
- Se a exigência permanecer, criar rota real protegida e testes; se não, atualizar requisitos e navegação sem fingir equivalência.

Gate: requisito e implementação convergem.

## FASE C — P2

Objetivo: desempenho, manutenção e observabilidade.

### C1. Performance de banco

- Triar 76/175 FKs sem índice com base em joins/deletes reais.
- Usar `EXPLAIN (ANALYZE, BUFFERS)` em staging representativo.
- Corrigir initplans RLS com padrão `(select auth.uid())` quando aplicável.
- Consolidar policies permissivas múltiplas por ação/papel.
- Remover índices duplicados somente após comprovação de equivalência; índices “unused” não devem ser removidos sem janela representativa.
- Adicionar PK nas 5 tabelas Deskcomm que realmente exigirem identidade.

Gate: plano de queries críticas dentro do orçamento de latência e sem regressão de escrita.

### C2. Paginação e N+1

- Substituir agregações em memória limitadas a 5.000 quando puderem truncar métricas.
- Paginar listas grandes de tasks, contatos, compras e produção.
- Revisar query aninhada em Opportunity 360 e signed URLs em loop.
- Definir budgets por tela/API.

Gate: testes com volume representativo e métricas p95.

### C3. Segurança de plataforma

- Ativar proteção de senha vazada no ambiente final.
- Fixar `search_path` das functions restantes.
- Mover extensões para schema apropriado quando suportado e seguro.
- Revisar CSP para reduzir `unsafe-inline`.
- Catalogar rate limit por login, upload, webhook e proposta pública.

Gate: advisors triados, com exceções justificadas por escrito.

### C4. Lint e dívida técnica

- Resolver 344 warnings por famílias: state em effect, imports, tipos, hooks e acessibilidade.
- Atualizar integração Sentry depreciada.
- Separar testes específicos de POSIX no CI Linux.

Gate: lint sem warnings novos e orçamento de warnings igual a zero ou baseline aprovado.

### C5. Documentação canônica

- Marcar todo documento como `CURRENT`, `TARGET`, `HISTORICAL` ou `SUPERSEDED`.
- Tornar `MASTER-SYSTEM-AUDIT.md` a fotografia datada, não uma promessa contínua.
- Tornar arquitetura Selma o índice canônico para agentes futuros.
- Isolar PRDs/épicos Deskcomm como referência de origem, não ordem para substituir a Selma.
- Documentar project refs por ambiente sem secrets.

Gate: nenhum documento atual contradiz runtime, auth, banco ou fonte de verdade.

## FASE D — PCP avançado

Objetivo: completar o que já existe no Lote 8 antes de criar novos domínios produtivos.

- Consolidar um único estado de produção e um histórico append-only de transições.
- Completar Kanban, fila, responsáveis, prazos, prioridade, dependências, bloqueios, anexos e observações.
- Propagar cor/tamanho do orçamento até finalização sem perda de grade.
- Homologar ficha técnica versionada, BOM, perdas técnicas, reservas, sugestões de compra e capacidade.
- Adicionar execução por etapa com quantidade planejada, boa, refugada/retrabalhada e tempo produtivo/parado.
- Expandir capacidade para setor e, somente quando necessário, máquina, equipe, oficina e turno.
- Formalizar KPIs: lead time, throughput, WIP, atraso, produtividade, utilização e retrabalho.
- Calcular OEE apenas para recursos com disponibilidade, ciclo e qualidade observáveis.
- Criar OS interna/externa ligada ao pedido, grade, prazo, arquivos, fornecedor e custo.
- Produzir previsão atual de entrega e motivo do risco com cálculo determinístico auditável.

Gate: pedido real de staging percorre grade → ficha → BOM → reserva → compra → rota → produção → finalização; concorrência e indicadores reconciliam com as linhas de origem.

## FASE E — Financeiro avançado

Objetivo: completar custo e ledger antes de dashboards financeiros ou IA.

- Criar custo previsto versionado e custo real por material, compra, OS, mão de obra, frete e adicional.
- Exibir diferença e margem prevista/real por pedido.
- Completar calculadora comercial com impostos configuráveis, comissão e margem desejada.
- Implementar comissão como ledger de estados: prevista, liberada, paga e cancelada.
- Criar contas a pagar ligadas a fornecedor, compra, OS, categoria e centro de custo.
- Consolidar entradas e saídas em uma visão financeira reconciliável.
- Implementar categorias, centros de custo e dimensões por pedido/setor/cliente/fornecedor.
- Implementar fluxo de caixa realizado/projetado e DRE gerencial com definições explícitas.
- Implementar importação OFX idempotente, sugestão de match e conciliação reversível.

Gate: pedido completo reconcilia receita, recebíveis, pagamentos, custos e margem; reimportar OFX não duplica; DRE/caixa chegam às mesmas linhas do ledger.

## FASE F — Atendimento integrado

Objetivo: portar somente as capacidades Deskcomm autorizadas para o runtime Selma.

- Portar channel adapters, conversations, messages, attachments, filas, assignment, transfer e handoff.
- Portar Inbox de três painéis e contexto read-only de cliente/orçamento/pedido Selma.
- Portar templates e aprovações do provedor.
- Homologar WAHA em staging e avaliar Meta Cloud API oficial para produção.
- Medir SLA, primeira resposta, tempo médio, volume e conversão para oportunidade/venda.
- Preparar contrato omnichannel sem criar clientes por canal.
- Avaliar campanhas somente após consentimento, opt-out, rate limit, templates e logs.

Gate: uma sessão Selma recebe, atribui, responde e transfere conversa; o atendente vê o pedido Selma; replay não duplica mensagem/lead/cliente.

## FASE G — BI e camada semântica

Objetivo: garantir números explicáveis antes de IA analítica.

- Criar catálogo versionado de KPI com definição, fórmula, fonte, período, timezone e filtros.
- Criar Gestor 360 com comercial, produção, financeiro, atendimento e estoque.
- Implementar comparativo de períodos com janelas equivalentes.
- Exigir drill-down para as linhas que compõem cada KPI.
- Criar central de relatórios com filtros comuns e exportação server-side PDF/CSV/XLSX.
- Implementar timeline consolidada Lead → Pós-venda usando eventos e mappings canônicos.
- Permitir composição de dashboard por papel/usuário respeitando RBAC.

Gate: KPIs iguais não divergem entre telas, todo número crítico abre seu conjunto de origem e exportações respeitam filtros/permissões.

## FASE H — IA assistiva

Objetivo: adicionar IA somente sobre dados homologados e autorizados.

- Inbox: resumo, resposta sugerida, intenção, urgência, pedido/orçamento citado e próxima ação.
- PCP: explicação de risco de atraso e perguntas sobre fila, material, capacidade e produção diária necessária.
- BI: perguntas sobre vendas, clientes, gargalos e caixa usando a camada semântica.
- Financeiro: sinalização de possível duplicidade, anomalia, margem negativa e variação de custo.
- Persistir versão do modelo/prompt, período, entidades/fontes e decisão do usuário.
- Aplicar RBAC antes da recuperação de dados e redigir campos proibidos antes do LLM.
- Proibir alteração automática de datas, preço, pedido, produção ou financeiro.

Gate: evals de grounding, autorização, não vazamento, alucinação e não-write; toda resposta informa período e dados considerados.

## FASE I — Fiscal em homologação

Objetivo: integrar um provedor fiscal adequado sem implementar protocolo fiscal próprio.

- Levantar dados fiscais, regime, certificado, SEFAZ/UF e obrigações com assessoria contábil/jurídica.
- Selecionar provedor com ambiente de homologação e contrato de idempotência.
- Mapear pedido/cliente/itens para documento sem redigitação.
- Implementar emissão, consulta, cancelamento, inutilização e carta de correção quando aplicável.
- Armazenar XML/DANFE em bucket privado com retenção e audit.
- Separar claramente DRE gerencial de escrituração/obrigação oficial.

Gate: todos os cenários passam somente no ambiente fiscal de homologação; nenhum teste emite NF-e real.

## FASE J — Alertas, pendências e pós-venda

Objetivo: transformar eventos dos módulos homologados em trabalho acionável.

- Unificar alertas de venda, proposta, pedido, material, compra, capacidade, financeiro, atendimento e fiscal.
- Adotar severidades INFO, ATENÇÃO, ALTO e CRÍTICO.
- Deduplicar por episódio e permitir preferências por usuário/papel.
- Criar página “O que precisa da minha atenção” com owner, prazo, motivo e drill-down.
- Encadear entrega, satisfação, nova oportunidade e reativação como pós-venda.

Gate: evento repetido não gera spam, links abrem a causa exata e o usuário só recebe o que pode acessar.

## FASE K — QA completo e P3

Objetivo: acabamento, experiência e operação contínua.

### K1. QA visual responsivo

- Capturar e revisar 390, 768, 1440 e 1920 px.
- Cobrir login, dashboard, CRM central, funil, leads, analytics, reativação, orçamento, proposta, Inbox e Pedido 360.
- Verificar loading, error, empty, long text e dados densos.

Gate: screenshots de referência e regressão visual aprovadas.

### K2. Acessibilidade

- Rodar Axe nas rotas principais.
- Validar ordem de Tab, skip links, focus visible, dialogs, drag-and-drop por teclado, labels e anúncios de erro.
- Medir contraste em light/dark.

Gate: zero violação crítica/séria e checklist manual aprovado.

### K3. Build e operação offline

- Hospedar fontes localmente ou documentar de forma explícita a dependência de rede no build.
- Validar build Linux/Windows conforme matriz suportada.
- Verificar standalone, service worker, Sentry e source maps.

Gate: build hermético ou dependências externas intencionalmente controladas.

### K4. Observabilidade e runbooks

- Dashboards para auth failures, webhook retries, duplicate prevention, dead jobs, realtime disconnects e bridge failures.
- Alertas com owner, severidade e runbook.
- Ensaiar backup, restore e rollback antes do release.

Gate: incidente simulado pode ser detectado, diagnosticado e revertido.

## Matriz de gates finais

| Gate | Critério mínimo |
| --- | --- |
| Git | árvore limpa, commit/tag identificado |
| Arquitetura | um Next.js, um login, uma sessão, um RBAC |
| Banco | staging isolado, install/update/rollback reproduzíveis, ledger correto |
| Segurança | 401/403, RLS cross-user/tenant, definers e storage homologados |
| Selma operacional | rotas e fluxos fabris sem regressão |
| CRM | fonte única, convert lead e Kanban reais |
| Quotes | versão/proposta/approval/conversion/receivables reais |
| Atendimento | WAHA/Meta, Inbox, message, assignment e realtime reais |
| Integração | fluxo WhatsApp → pedido Selma completo e idempotente |
| Qualidade | lint, typecheck, unit, SQL, integration, E2E, build e audit verdes |
| UX | quatro breakpoints e acessibilidade aprovados |
| Operação | backup/restore/rollback e observabilidade ensaiados |

## Ordem recomendada de execução

1. A1–A2: congelar e criar staging isolado.
2. A3–A5: runtime, identidade, RBAC e dados únicos.
3. A6–A7: bridge e contratos de API.
4. A8: gate P0 completo.
5. B1–B5: homologar segurança, operação, CRM e orçamento existentes.
6. B6–B8: atendimento-base, dependências e requisito `/corte`.
7. C1–C5: desempenho, hardening e documentação canônica.
8. D: PCP avançado.
9. E: financeiro avançado.
10. F: atendimento integrado.
11. G: BI e camada semântica.
12. H: IA assistiva.
13. I: fiscal em homologação.
14. J: alertas, pendências e pós-venda.
15. K: QA completo e GO/NO-GO.

## Critério de encerramento

O sistema só deve receber veredito “aprovado para produção” quando não houver P0/P1 aberto, todos os gates finais estiverem verdes no mesmo commit candidato e a restauração do backup tiver sido comprovada. Este plano não autoriza execução automática de nenhuma etapa.
