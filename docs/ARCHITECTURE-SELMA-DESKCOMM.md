# Arquitetura oficial — Selma + módulo comercial Deskcomm

Status: **APP-1 concluída na aplicação; 🧪 aguardando banco real**. Este
documento substitui a estratégia de duas aplicações ligadas por proxy.

## Resultado obrigatório

- Um repositório final: `selmabordados-1`.
- Uma aplicação Next.js e um processo web.
- Uma tela de login em `/login`.
- Uma sessão Supabase Auth canônica.
- O módulo comercial vive dentro da aplicação, sob `/comercial`, sem aplicação,
  servidor, cookie ou login próprios.
- A operação fabril existente continua sendo a fonte de verdade de orçamento,
  proposta, pedido, financeiro, estoque, compras, arte, PCP, corte, bordado, DTF,
  sublimação, oficinas, acabamento e produção.

`/comercial` é apenas um namespace de rotas da mesma aplicação. Não representa
uma segunda aplicação.

## Responsabilidades

### Comercial

O código incorporado do Deskcomm responde por atendimento, Inbox, WhatsApp,
conversas, mensagens, contatos comerciais, leads/negócios, funil, tarefas
comerciais, IA e automação comercial.

### Operação

O código Selma existente responde por orçamentos especializados, propostas,
pedidos fabris e todos os módulos de fábrica. Esses módulos não podem ser
reimplementados pelo módulo comercial.

## Fronteira obrigatória

O módulo comercial não consulta nem altera tabelas fabris diretamente. Toda
integração passa pelo contrato `DeskcommCommercialBridge`.

Operações permitidas pelo contrato:

- localizar ou criar o cliente Selma correspondente;
- criar um orçamento usando o domínio de orçamento da Selma;
- ler orçamento e proposta Selma;
- listar pedidos fabris vinculados;
- ler o estado de um pedido fabril.

O contrato não expõe métodos para movimentar produção, estoque, financeiro,
corte, bordado, DTF, sublimação, oficinas ou acabamento.

## Autenticação e autorização

O usuário autentica uma vez em `/login`. A sessão é validada no servidor com o
Supabase Auth canônico. O módulo comercial e a operação usam o mesmo usuário.

O acesso a `/comercial` exige autorização server-side. A visibilidade do item de
menu nunca é considerada proteção suficiente.

Mapeamento inicial de papéis:

| Papel Selma | Acesso comercial |
| --- | --- |
| `administrator` | administração comercial |
| `manager` | gestão comercial |
| `commercial` | operação comercial |
| `salesperson` | carteira, Inbox, funil e tarefas atribuídas |
| `production`, `inventory`, `purchasing`, `finance` | sem acesso comercial por padrão |

## Banco real deferido

O banco atualmente configurado é apenas referência para a construção da
aplicação. Não é o banco definitivo e não deve receber migrations, seeds,
usuários de teste, correções de ledger nem qualquer write desta fase.

Providers, migrations, RLS, Storage, Realtime, concorrência e E2E de escrita
serão implementados e homologados somente no Track DB, depois da APP-15. O plano
preservado está em [`DATABASE-DEFERRED-PLAN.md`](DATABASE-DEFERRED-PLAN.md).

## CRM legado

O Deskcomm será a fonte oficial para leads, funil e tarefas comerciais. A UI CRM
legada só poderá ser desativada depois que os vínculos e a reconciliação forem
homologados. `/crm/orcamentos` permanece, pois orçamento e proposta pertencem à
Selma.

## Estado da consolidação

O proxy e o servidor comercial separados foram removidos. `/comercial` agora é
protegido pela mesma sessão e pelo mesmo RBAC do restante da aplicação. As rotas
de funil, contatos, tarefas, análise e configuração já convergem para os módulos
internos existentes.

A rota `/comercial/app/inbox` agora entrega a superfície responsiva de três
painéis dentro do runtime Selma, com fixtures tipadas, filtros e contexto de
pedido somente leitura. Envio, anexos e assignment permanecem desabilitados até
o MessagingProvider da APP-8.

Mensagens reais, realtime, canais, IA e automações avançadas continuam
planejados nas fases APP correspondentes. Eles não podem voltar a usar outro
servidor ou outro login durante essa incorporação.
