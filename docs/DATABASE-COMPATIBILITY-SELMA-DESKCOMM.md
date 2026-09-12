# Compatibilidade de banco — Selma + Deskcomm

Status: plano pré-migration. Nenhuma mudança de schema foi aplicada por este
plano.

## Inventário confirmado em 11/09/2026

- Banco comercial de teste `fzbkzugukvngsbygzgjn`: tabelas Deskcomm, incluindo
  `organizations`, `user_organizations`, `contacts`, `conversations`, `messages`,
  `crm_leads`, `crm_pipelines`, `crm_stages`, `crm_tasks`, `automation_rules` e os
  módulos de IA.
- Banco operacional `zaskzrplimoudreqodbf`: 287 pedidos, 999 itens de pedido e
  715 clientes, além dos módulos fabris, financeiro, estoque, compras, propostas
  e CRM legado.

## Colisões confirmadas

Os nomes abaixo existem nos dois bancos, mas não possuem o mesmo contrato:

- `contacts`
- `automation_rules`
- `crm_leads`
- `crm_pipelines`
- `crm_stages`
- `ai_knowledge_versions`

Há ainda uma colisão semântica crítica: `public.orders` no Deskcomm representa
pedidos de provedores externos e não corresponde a `public.pedidos` da fábrica.

Os modelos de autorização também são diferentes: o Deskcomm usa
`organizations`/`user_organizations`; a Selma usa
`profiles`/`roles`/`user_roles`/`role_permissions`.

## Estratégia escolhida

1. Manter as tabelas comerciais Deskcomm no schema `public` do banco de teste.
2. Criar o schema privado `selma` no banco de teste apenas depois do backup e da
   revisão da migration.
3. Reproduzir no schema `selma` somente as tabelas operacionais necessárias,
   preservando nomes, tipos, constraints e regras de negócio da Selma.
4. Não copiar o CRM legado (`crm_leads`, funis, tarefas ou automações) para o
   schema operacional; o Deskcomm será a fonte comercial oficial.
5. Manter orçamento/proposta no domínio Selma e acessá-los exclusivamente pelo
   `DeskcommCommercialBridge`.
6. Criar `public.commercial_entity_links` com vínculos por UUID, nunca por nome.
7. Usar uma única identidade Supabase Auth e uma matriz explícita de RBAC.

## Estrutura prevista para vínculos

`commercial_entity_links` terá, no mínimo:

- `organization_id`
- `deskcomm_contact_id`
- `deskcomm_lead_id`
- `selma_customer_id`
- `selma_contact_id`
- `selma_quote_id`
- `selma_order_id`
- `created_at`
- `updated_at`

As constraints finais serão definidas após validar cardinalidade e ciclo de vida
dos orçamentos e pedidos. A tabela terá RLS e unicidade por organização e par de
entidades.

## Backup antes de migration

Antes de qualquer DDL ou cópia de dados:

1. gerar dump somente de schema dos dois projetos;
2. gerar dump dos dados operacionais necessários;
3. registrar contagens por tabela e checksums dos módulos críticos;
4. restaurar os dumps em ambiente descartável;
5. executar a migration de compatibilidade no ambiente descartável;
6. executar testes de RLS, autenticação e regressão operacional;
7. somente então avaliar aplicação no banco de teste `fzb...`.

Nenhum passo acima autoriza alteração no banco operacional em uso.

## Rollback

- O banco operacional permanece sem DDL do Deskcomm.
- A aplicação operacional atual continua sendo o ponto de retorno.
- No banco de teste, o rollback remove somente os objetos criados pela migration
  de integração, após validar que não possuem dados exclusivos.
- A configuração da aplicação retorna ao último build operacional validado.
- Os vínculos são exportados antes do rollback para permitir reconciliação.

## Proteção dos módulos operacionais

Hashes SHA-256 agregados antes da incorporação:

| Módulo | Arquivos | SHA-256 |
| --- | ---: | --- |
| produção | 3 | `c7fd89baf6a548c14ec9c75ec5c675f3454fe916de97acfb197112c8ebae71c8` |
| bordados | 2 | `8bee433bdf70c939e276c23adc9ae58e6ed68e608f5a13f0fae2d830356aee68` |
| DTF | 2 | `cbe157bdb96eb289a654c7f8e8faca8e3fb383c0aacbbe40a29a95eea5edd27a` |
| sublimação | 2 | `ee411107ffb16327011fa478b0180556b36d696a86a02d880a457be512cfc5fd` |
| oficinas | 2 | `37db9e8e01c730071d443f9515c130916893fc4f30be44c0a08dcafafe894017` |
| acabamento | 2 | `0ade7573e3bdc400d2ce4709ccc2cafca691d6e59b0476ef8d58288865fa7da2` |
| estoque | 3 | `a46601ec9e1423df6a7225b9e0aa835dac4870b8469183c55d991939a7c88a3c` |
| compras | 1 | `46575748bb3e6637ff88943d930f6f2e7a1aeecec78a5ab1c65dd41d3fa5e925` |
| financeiro | 2 | `302433e7fc598937c3dd92e54ad3fd53ae0067bedd7aaea7daf0e201d56887d6` |

Esses hashes serão recalculados no encerramento. Mudança não explicada bloqueia
a homologação.
