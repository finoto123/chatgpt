# Benchmark Funcional — Selma Bordados

Data: 11/09/2026
Status: inventário de produto em dois tracks; **APP-1 concluída no Track A**.
Escopo: código, migrations, testes e documentação dos repositórios `selmabordados-1` e `selmabordados-next`.

Execução Master: **A1-APP ✅ aprovado; APP-1 ✅ APP COMPLETA · 🧪 BANCO REAL**. O snapshot externo de 5.464 arquivos, os hashes e o restore dry-run passaram. Banco definitivo, staging e baseline foram movidos para o Track DB e não bloqueiam o Track A.

## Leitura obrigatória dos status

Cada funcionalidade passa a ter duas avaliações independentes:

| Track | O que comprova | Status possível agora |
| --- | --- | --- |
| Aplicação | UI, UX, domínio, services, contratos, mocks, fixtures, unit/component/contract tests e build | ✅ APP COMPLETA ou estado parcial |
| Banco | PostgreSQL/Supabase definitivo, migrations, RLS, RPCs, Storage, Realtime, concorrência e performance SQL | 🧪 IMPLEMENTADO — AGUARDANDO BANCO REAL ou ⏸ DEFERIDO |

Nenhum item foi removido da matriz. Sempre que a coluna atual disser `✅`, a validação deve ser entendida como restrita à evidência explicitamente descrita; dependências de banco continuam `🧪` até o Track DB. A partir de APP-1, os relatórios de fase registrarão os dois status separadamente.

## Objetivo e limites

Este documento compara capacidades funcionais publicamente apresentadas pela Fabrex com o estado real encontrado no Selma. A Fabrex é usada somente como referência de categorias e resultados de negócio. Não foram copiados código, identidade visual, textos, componentes, fluxos proprietários ou layouts.

Fontes públicas consultadas:

- [Site oficial Fabrex — visão geral de gestão e PCP](https://fabrex.com.br/)
- [Apresentação oficial Fabrex — módulos funcionais](https://fabrex.com.br/apresentacao)

A comunicação pública consultada apresenta, em alto nível: PCP com Kanban e prazos, grade, ficha técnica/BOM, capacidade/gargalos, integração venda–pedido–produção, financeiro, WhatsApp multiatendimento, dashboards/relatórios, conciliação, fiscal e recursos assistidos por IA. A matriz abaixo não afirma equivalência técnica entre produtos; ela mede o Selma contra essas capacidades.

## Classificações

- ✅ Já temos e está validado
- 🧪 Temos, falta homologar
- 🟡 Temos parcialmente
- 🔴 Não temos
- ➕ Nova funcionalidade implementada
- 🚫 Não aplicável ao negócio

Nenhum item recebeu ➕ nesta etapa, pois a ordem aprovada exige corrigir os P0 arquiteturais antes de criar funcionalidades novas.

## Regra de fonte de verdade

- Selma permanece dono de orçamento, proposta, contrato futuro, pedido, ficha técnica, BOM, estoque, compras, PCP, produção, financeiro e fiscal.
- Deskcomm é fonte de componentes e regras que podem ser portados para atendimento, Inbox, canais, conversations, messages, filas, assignment, handoff, realtime, templates e automação conversacional.
- `Deskcomm.orders` não é pedido fabril. O pedido canônico é `Selma.pedidos`.
- A presença de arquivo ou migration não transforma um item em ✅ sem teste real em staging.

## Matriz de benchmark

| Funcionalidade | Já existe? | Estado atual | Fabrex benchmark | Implementar? | Prioridade | Dependências | Teste necessário |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Aplicação e fonte de dados únicas | Parcial | ✅ Runtime, navegação e login únicos; 🧪 fonte de dados definitiva aguarda o banco real | Operação integrada em um ambiente | Completar o dado nas fases posteriores | P0 | Auth, providers, schema e bridge | Login único + fluxo ponta a ponta |
| CRM e funil comercial | Sim | 🧪 CRM Selma amplo; Deskcomm duplica o domínio | Funil ligado a vendas e produção | Homologar e eleger fonte única | P0/P1 | Unificação de entidades | Lead → oportunidade → orçamento |
| Scoring de leads/oportunidades | Sim | 🧪 Regras, score, temperatura e override no banco | Scoring e priorização comercial | Homologar, não recriar | P1 | CRM canônico e cron | Recalcular score e validar filtros |
| Automações comerciais | Sim | 🧪 Selma possui rules/runs; Deskcomm possui outro motor | Automação ligada ao funil | Consolidar | P1 | Fonte única de eventos | Idempotência e execução programada |
| Orçamentos e propostas | Sim | 🧪 Versões, itens, grade, pricing, approvals e proposta pública | Proposta vira pedido sem redigitação | Homologar, não recriar | P1 | Migrations canônicas | V1/V2, token, aprovação e conversão |
| Contratos comerciais | Não | 🔴 Não há domínio funcional de contratos Selma | Contratos vinculados à venda | Sim | P2 | Cliente, oportunidade, quote e storage | Versão, vigência, vínculo e RBAC |
| Assinatura eletrônica | Não | 🚫 Fora do escopo até definir provedor/requisitos legais | Pode complementar contratos | Não nesta fase | futuro | Jurídico + provedor | Homologação jurídica e sandbox |
| Pedido fabril | Sim | ✅ Base operacional existente e build verde; fluxo completo não foi retestado | Pedido centraliza execução | Preservar e homologar | P0/P1 | Bridge e migrations | Criação/update/rollback/idempotência |
| Conversão proposta → pedido | Sim | 🧪 RPC com locks, unicidade e recebíveis | Conversão sem redigitação | Homologar | P0/P1 | Quote e pedido canônicos | Duas chamadas concorrentes + rollback |
| Grade por tamanho no orçamento | Sim | 🧪 `quote_item_sizes` e validação de soma | Grade acompanha a venda | Homologar | P1 | Quote migrations | Soma server-side e snapshots |
| Grade por cor e tamanho ponta a ponta | Parcial | 🟡 Grade existe em orçamento/pedido, mas não foi provada em BOM, compras, produção e finalização | Grade acompanha o ciclo produtivo | Completar | P1 | Modelo de variante canônico | Conversão integral sem perda |
| Ficha técnica | Sim | 🧪 Tabela, versões e campos básicos em Lote 8 não homologado | Dados técnicos junto da produção | Completar/homologar | P1 | Arte, pedido, variante e storage | Versão imutável + anexos |
| Ficha técnica industrial completa | Parcial | 🟡 Faltam evidências para aviamentos, múltiplas imagens/arquivos, processos detalhados e grade/cores completas | Ficha e BOM vinculadas | Completar | P1 | Catálogos técnicos | E2E edição/versionamento |
| BOM | Sim | 🧪 Necessidade, perda técnica e itens existem em migration não homologada | Materiais derivados do pedido | Homologar | P1 | Ficha, tecidos e grade | Cálculo com perdas e variantes |
| Necessidade líquida de compra | Parcial | 🧪 Sugestões, estoque/reserva e compras existem; não homologados | Indica o que falta comprar | Homologar/completar | P1 | BOM, saldo e reservas | Necessidade − disponível − reservado |
| Reserva de material | Sim | 🧪 Locks, reserva e consumo previstos | Estoque ligado à produção | Homologar | P1 | Ledger de estoque | Duas reservas concorrentes |
| Compras | Sim | 🧪 Fornecedor, pedido, itens e recebimento parcial existem | Compras alimentam produção | Homologar | P1 | BOM e estoque | Recebimento idempotente e parcial |
| PCP básico | Sim | 🟡 Produção tradicional e plano/rota novos coexistem | Planejamento por etapas | Consolidar | P1 | Pedido, etapas e capacidade | Pedido → rota → execução |
| Kanban de produção | Parcial | 🟡 Há painéis/etapas, mas não há Kanban avançado homologado com WIP e dependências | Kanban por etapa | Completar | P1 | Estado de etapa canônico | Drag/drop, concorrência e histórico |
| Etapas produtivas configuráveis | Parcial | 🟡 Workcenters/route steps existem; configuração completa por UI não foi encontrada | Fluxos produtivos personalizáveis | Completar | P1 | RBAC e versionamento de rota | Alteração sem afetar pedido em curso |
| Responsável e prazo por etapa | Parcial | 🟡 Datas planejadas/reais existem; responsável por execução não está completo | Responsabilidade e prazo visíveis | Completar | P1 | Usuários/equipes/oficinas | Atribuição, reatribuição e audit |
| Histórico/anexos/observações por etapa | Parcial | 🟡 Timestamps e dados do pedido existem; timeline industrial completa não | Rastreabilidade por etapa | Completar | P1 | Audit e storage | Append-only e signed URLs |
| Bloqueios e dependências de produção | Sim | 🧪 Gates de arte, material, ficha, BOM e plano existem no Lote 8 | Alertas antes do atraso | Homologar/ampliar | P1 | Planejamento | Cada bloqueio impede release |
| Quantidade planejada/produzida/refugada | Parcial | 🟡 Planejada existe; produzida aparece em módulos legados; refugo/retrabalho não é domínio consistente | Controle quantitativo da etapa | Completar | P1 | Eventos de execução | Balanço de quantidades |
| Fila de produção e WIP | Parcial | 🟡 Fila é inferida por steps pendentes; WIP oficial não | Visão de pedidos em cada etapa | Completar | P2 | Eventos/status de etapa | WIP por período/setor |
| Gargalo produtivo | Sim | 🧪 View e dashboard destacam maior utilização futura | Gargalos destacados | Homologar/ampliar | P1 | Capacidade e fila confiáveis | Cenários com centros sobrecarregados |
| Capacidade por setor/dia | Sim | 🧪 Workcenters, capacidade diária e calendário existem | Capacidade versus carga | Homologar | P1 | Calendário e rotas | Carga 85%, 95%, >100% |
| Capacidade por máquina/equipe/turno | Não | 🔴 Modelo atual é principalmente workcenter/dia | Planejamento mais granular quando aplicável | Sim, conforme realidade | P2 | Cadastro de recursos e turnos | Capacidade e indisponibilidade |
| Oficinas externas na capacidade | Parcial | 🟡 Oficinas existem no legado; não estão integradas ao novo capacity plan | Terceiros dentro do PCP | Completar | P1 | OS, compras e prazo fornecedor | Capacidade/prazo/custo externo |
| Previsão determinística de entrega | Sim | 🧪 Considera quantidade, sequência, fila, capacidade, dias úteis, feriados e bloqueios | Prazo calculado antes de prometer | Homologar/completar | P1 | Dados produtivos confiáveis | Prometida versus prevista e motivo |
| Alerta comercial de prazo inviável | Parcial | 🟡 Data segura preliminar existe no orçamento; fluxo comercial não foi homologado | Impede promessa incompatível | Completar | P1 | Quote + capacity plan | Cenário de capacidade excedida |
| Lead time total/comercial/aprovação/produção | Parcial | 🟡 Existem timestamps, mas não há indicador consolidado e comparativo | Indicadores de tempo de ciclo | Sim | P2 | Eventos canônicos | Fórmula, timezone e períodos |
| Lead time por etapa e tempo parado | Parcial | 🟡 Planned/actual timestamps existem; ausência de métricas oficiais | Tempo por fase produtiva | Sim | P2 | Histórico de transições | Tempo produtivo versus espera |
| Throughput e produtividade por setor | Não | 🔴 Não há cálculo oficial confiável | Indicadores PCP | Sim | P2 | Quantidades concluídas e horas | Período/setor/turno |
| OEE | Não | 🔴 Sem disponibilidade/performance/qualidade e dados de máquina suficientes | OEE quando aplicável | Somente onde houver dados reais | P3 | Máquinas, paradas, ciclo e refugo | Validação da fórmula por recurso |
| Eficiência operacional sem OEE artificial | Parcial | 🟡 Utilização de capacidade existe | Métricas adequadas ao processo | Sim | P2 | Throughput/WIP/lead time | Comparar capacidade e entrega |
| Previsão assistida de atraso por IA | Não | 🔴 Há cálculo determinístico, não explicação IA auditável | Previsão e explicação assistidas | Sim após PCP confiável | P3 | Feature data, RBAC e audit | Grounding, período, fontes e não-write |
| Central de alertas operacionais | Parcial | 🟡 `notifications` e alguns eventos existem; faltam unificação, severidade e preferências | Alertas de atraso/falta/financeiro | Completar | P2 | Eventos de todos os domínios | Dedup, severidade e links |
| Central “precisa da minha atenção” | Parcial | 🟡 CRM dashboard, notificações e PCP estão separados | Visão acionável única | Completar | P2 | Alertas canônicos | Ordenação, RBAC e drill-down |
| Ordens de Serviço | Não | 🔴 Nenhuma tabela/fluxo funcional encontrado | OS interna/terceirizada ligada à produção | Sim | P1 | Pedido, grade, oficina e custos | Ciclo, anexos, prazo e custo real |
| Custo previsto do pedido | Parcial | 🟡 Quote calcula custo estimado; BOM/processos não fecham custo industrial completo | Custo antes da venda | Completar | P1 | BOM, processo, terceiros e frete | Recalcular e versionar premissas |
| Custo real do pedido | Não | 🔴 Não agrega consumo, compras, OS, mão de obra e adicionais | Previsto versus realizado | Sim | P1 | Ledger de custos | Reconciliação por origem |
| Margem prevista versus real | Parcial | 🟡 Margem prevista existe; real não | Gestão de rentabilidade | Completar | P1 | Custo real e receita líquida | Pedido encerrado com estorno |
| Calculadora comercial | Parcial | 🟡 Subtotal, desconto, frete, adicionais, custo/margem/markup existem | Preço ligado a custo e margem | Completar, não recriar | P1 | Impostos, comissão e custos | Casos por quantidade/grade |
| Sugestão inteligente de preço | Não | 🔴 Nenhum motor de recomendação auditável | Sugestão baseada em custo/histórico | Sim após custo confiável | P3 | Histórico, regras e explicabilidade | Sugere sem alterar automaticamente |
| Comissão básica de vendedor | Parcial | 🟡 Campo percentual em cadastro; não há ledger/ciclo da comissão | Metas e comissionamento | Completar | P2 | Vendas, margem e recebimento | Prevista/liberada/paga/cancelada |
| Regras avançadas de comissão | Não | 🔴 Sem regras por equipe/produto/cliente/meta/período | Comissionamento configurável | Sim | P2 | Rule engine e financeiro | Cancelamento/estorno não comissiona |
| Metas comerciais | Sim | 🧪 `sales_targets`, realizado e dashboards existem | Metas por vendedor/equipe | Homologar/ampliar | P2 | Receita/margem canônicas | Meta, realizado, %, projeção |
| Contas a receber | Sim | 🧪 Receivables, allocations, payments e estorno separados | Financeiro ligado ao pedido | Homologar | P1 | Quote/order/payment | Parcelas, juros, desconto e estorno |
| Contas a pagar | Não | 🔴 Nenhum domínio funcional encontrado | Obrigações de fornecedores/despesas | Sim | P1 | Compras, OS, categorias e ledger | Parcela/recorrência/pagamento |
| Ledger financeiro único | Parcial | 🟡 Ledger de recebimentos existe; não cobre saídas | Entradas e saídas integradas | Expandir | P1 | A receber + a pagar | Dupla entrada lógica e audit |
| Fluxo de caixa realizado/projetado | Não | 🔴 Não encontrado | Projeções por horizonte | Sim | P2 | Ledger completo | 7/30/60/90/customizado |
| DRE gerencial | Não | 🔴 Não encontrado | Resultado gerencial por período | Sim, sem confundir com contabilidade oficial | P2 | Categorias, custo e competência/caixa | Fórmulas e reconciliação |
| Categorias e centros de custo | Não | 🔴 Não há estrutura financeira completa | Rastreabilidade por origem | Sim | P1 | Ledger e cadastros | Segmentação pedido/setor/fornecedor |
| Conciliação OFX | Não | 🔴 Referências textuais não equivalem a implementação | Importação e conciliação bancária | Sim | P2 | Ledger, parser e idempotência | Reimportação/duplicidade/diferença |
| Fiscal/NF-e | Não | 🔴 Existem campos de número/data de nota, não emissão fiscal | Documento fiscal ligado ao pedido | Sim apenas via homologação/provedor | P3 | Levantamento legal e provedor | Sandbox SEFAZ, cancelamento, XML/DANFE |
| Inbox compartilhado | Sim, superfície APP-1 | ✅ Está no runtime Selma com três painéis, filtros e contexto operacional read-only; 🧪 providers reais pendentes | Atendimento conectado à operação | Completar providers na APP-8 | P0/P1 | Auth, messaging, realtime e banco real | Responsivo + duas sessões em staging |
| Filas, distribuição e responsável | Existe no Deskcomm | 🧪 Código/schema extensos, não integrados | Multiatendimento por equipe | Portar | P1 | Membership e RBAC canônicos | Claim/transfer/race |
| Handoff humano | Existe no Deskcomm | 🧪 Motor e testes existem isoladamente | Transferência assistida | Portar | P1 | Conversation state | IA → humano → retomada |
| SLA e indicadores por atendente | Parcial no Deskcomm | 🧪 Não integrado aos KPIs Selma | Tempos e desempenho de atendimento | Portar/completar | P2 | Eventos de conversation/message | Primeira resposta e TMA |
| WhatsApp WAHA | Existe no Deskcomm | 🧪 Adapters/webhooks/dedup; serviço não homologado aqui | Canal conectado ao pedido | Portar via abstração | P1 | Secrets, webhook e staging | Inbound/outbound/ack/replay |
| WhatsApp Cloud API | Existe parcialmente no Deskcomm | 🧪 Rotas/templates oficiais aparecem; não homologado | Canal oficial quando aplicável | Portar conforme provedor | P2 | Meta sandbox | Template/media/status |
| Abstração de canal | Existe no Deskcomm | 🧪 Modelo channel/conversation/message/attachment | Evita acoplamento a um provedor | Portar | P1 | Contratos normalizados | Mesmo fluxo em dois providers |
| Omnichannel | Parcial no Deskcomm | 🟡 Arquitetura de canais existe; e-mail/chat unificados não foram provados | Histórico de canais em um Inbox | Preparar, sem inventar conectores | P3 | Channel adapter | Mesma pessoa sem duplicação |
| Templates de mensagens | Existe no Deskcomm | 🧪 Message/meta templates e versionamento no app separado | Templates por equipe/provedor | Portar | P2 | Canal, aprovação e RBAC | Variáveis/versionamento/permissão |
| Campanhas segmentadas | Parcial no Deskcomm | 🟡 Há código/migrations de campanhas; não integrado nem homologado | Audiência, envio e métricas | Avaliar e portar | P3 | Consentimento, templates e filas | Opt-out, rate limit e logs |
| IA para resumo e resposta no Inbox | Existe no Deskcomm | 🧪 Runtime amplo; credenciais ausentes no build local e app separado | Assistência contextual | Portar somente após dados/RBAC | P2/P3 | Inbox integrado e LLM gateway | Sugestão sem envio automático |
| IA para intenção/urgência/próxima ação | Existe no Deskcomm | 🧪 Agentes/routers/handoff existem isolados | Triagem assistida | Portar seletivamente | P3 | Política, evals e audit | Precisão, fallback e autorização |
| Resumo com pedido/orçamento Selma | Não integrado | 🔴 IA Deskcomm não usa bridge operacional Selma | Contexto de atendimento e produção | Sim | P1/P2 | Bridge read-only | Grounding sem vazamento fabril |
| Dashboard executivo 360 | Parcial | 🟡 Dashboards Selma e Deskcomm são separados; faltam AP/caixa/SLA/custos | Visão geral integrada | Completar depois dos ledgers | P2 | KPIs canônicos | Reconciliação e drill-down |
| Timeline única do pedido | Parcial | 🟡 Há histórico em domínios, não uma linha Lead → Financeiro/Fiscal | Progresso visível entre áreas | Sim | P2 | Event log e mappings | Ordenação, origem e RBAC |
| Relatórios por domínio | Parcial | 🟡 CRM analytics e consultas operacionais existem; central não | Relatórios empresariais | Completar | P2 | Read models | Filtros, paginação e permissão |
| Exportação PDF | Parcial | 🟡 Proposta/prints e libs PDF existem; não há política central | Exportação de documentos/relatórios | Completar onde necessário | P3 | Render server-side | Filtros e grande volume |
| Exportação CSV/XLSX | Não de forma central | 🔴 Dependências/fluxo auditável não encontrados no Selma | Exportações de relatórios | Sim | P3 | Jobs server-side | Mesmos filtros da tela |
| Dashboards por usuário/papel | Não | 🔴 Sidebar/RBAC existe, layout personalizável não | Visões por perfil | Sim | P3 | Preferências e RBAC | Persistência e fallback |
| Comparativo de períodos | Parcial | 🟡 Analytics aceita datas; comparativos não são padrão transversal | Atual versus período anterior | Completar | P2 | KPI definitions | Mesma janela e timezone |
| Drill-down de KPIs | Parcial | 🟡 Algumas listas vinculadas; não é contrato obrigatório | Número investigável | Completar | P2 | Filtros serializáveis | KPI → conjunto exato de linhas |
| Catálogo de definição de KPIs | Não | 🔴 Fórmula/fonte/timezone não estão centralizados | Indicadores consistentes | Sim antes de BI/IA | P1/P2 | Semantic layer | Reconciliação entre telas |
| BI com IA | Não integrado | 🔴 Deskcomm tem runtime IA, mas não camada analítica Selma autorizada | Perguntas sobre a operação | Sim após KPIs confiáveis | P3 | Semantic layer, RLS e evals | Resposta cita período/fontes |
| IA financeira para anomalias | Não | 🔴 Não encontrado | Detecção assistida | Sim após ledger completo | P3 | Histórico financeiro | Sinaliza sem escrever |
| IA operacional | Não | 🔴 Não há assistente conectado ao PCP Selma | Perguntas de capacidade/risco | Sim após PCP homologado | P3 | Read models e RBAC | Grounding e não alteração |
| Pós-venda integrado | Não | 🔴 Fluxo final consolidado não encontrado | Continuidade após entrega | Sim após core | P3 | Pedido entregue, CRM e atendimento | Entrega → satisfação/reativação |

## Resumo quantitativo

Esta contagem é por linha funcional da matriz, não por arquivo:

- ✅ validado: poucos itens de infraestrutura/base; nenhum novo módulo competitivo foi declarado concluído;
- 🧪 existente e aguardando homologação: CRM, scoring, orçamento, pedidos, BOM, compras, capacidade, proposta e grande parte do Deskcomm;
- 🟡 parcial: PCP avançado, grade ponta a ponta, custos, comissões, dashboards, indicadores e alertas;
- 🔴 ausente: bridge real, OS, custo real, contas a pagar, caixa, DRE, centros de custo, OFX, fiscal funcional, OEE e camadas de IA integradas;
- ➕ novo implementado nesta etapa: runtime único e superfície local da Inbox com fixtures tipadas;
- 🚫 não aplicável agora: assinatura eletrônica própria e OEE onde não houver dados de máquina suficientes.

## Reuso obrigatório

Antes de qualquer nova tabela, componente, API ou RPC:

1. procurar nos dois repositórios e em todas as migrations;
2. definir qual implementação é canônica;
3. evitar portar módulos Deskcomm fora de atendimento/conversação;
4. preferir completar os Lotes 5–8 Selma em vez de criar versões paralelas;
5. registrar a decisão de reuso nesta matriz;
6. só alterar o status para ➕ depois da Definition of Done completa.

## Sequência de produto

```text
P0 arquiteturais
→ runtime/Auth/RBAC/dados únicos
→ staging reproduzível
→ homologação do que já existe
→ PCP avançado
→ financeiro avançado
→ atendimento integrado
→ BI e camada semântica
→ IA assistiva
→ fiscal em homologação
→ QA completo
→ GO/NO-GO
```

## Definition of Done

Uma linha só muda para ✅ ou ➕ quando houver, conforme aplicável: schema, migration, RLS, RBAC, backend, interface, tratamento de erros, audit log, testes unitários, integração, E2E crítico, build verde, homologação em staging e documentação atualizada. Recursos de IA devem informar período/fontes usados, respeitar RBAC e não alterar dados automaticamente sem regra e autorização explícitas.
