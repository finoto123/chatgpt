# Lote 3 — segurança, auditoria e staging

## Estratégia aplicada

As mutações de clientes, pedidos, itens, usuários, papéis, permissões, estoque,
financeiro, oficinas e DTF são auditadas por triggers AFTER na mesma transação.
Se o insert do log falhar, a mutação principal também falha. Login, logout,
convite e upload usam o helper central/RPC; o upload compensa falhas removendo o
novo objeto.

audit_logs não tem policy de INSERT, UPDATE ou DELETE para usuários. Apenas
SELECT por audit.view; escritas passam por funções controladas. A sanitização é
aplicada tanto na aplicação quanto no banco e remove chaves relacionadas a
senha, token, cookie, autorização, API key e service role.

O RPC exposto à sessão autenticada aceita somente login/logout do próprio
usuário e convite por quem possui `users.manage`; demais eventos vêm dos
triggers ou do RPC transacional de layout. Isso impede a fabricação arbitrária
de ações e entidades pela API pública.

## Storage

Aplicar a migration 202609070001_audit_storage_security.sql torna
pedidos-layouts privado sem renomear ou excluir objetos. URLs públicas antigas
salvas em pedidos.layout_pdf_url continuam tendo seu path extraído e são
convertidas em signed URLs de cinco minutos para usuários com orders.view.
Novos uploads usam pedido-id/uuid.ext; o nome original fica apenas em metadata
sanitizada do log.

Tipos permitidos: PDF, PNG, JPEG e WEBP. Limite: 10 MiB. Extensão, MIME e magic
bytes precisam concordar. A associação ao pedido ocorre no RPC
attach_order_layout, que valida usuário ativo, permissão e pedido.

## Rate limit

Quando UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN estão definidos,
login, convites e uploads usam contador Redis compartilhado, compatível com
funções serverless. Se a infraestrutura configurada falhar, o fluxo fecha por
segurança. Sem essas variáveis, o app não finge persistência local: permanece a
proteção nativa do Supabase Auth e o resultado é marcado internamente como não
aplicado. Configurar Redis antes de produção é recomendado.

Identificadores (inclusive e-mail no login) são enviados ao Redis apenas como
hash SHA-256, evitando expor dados pessoais em chaves e URLs do provedor.

## Headers e CSP

A política bloqueia objetos e frames externos, limita conexões à origem exata
do Supabase configurado e não permite `unsafe-eval`. `unsafe-inline` permanece
somente em scripts/estilos porque o runtime atual do Next e componentes
existentes ainda emitem conteúdo inline; migrar para nonce por requisição é o
endurecimento futuro recomendado, depois de validar todos os fluxos em staging.

## CSRF

As mutações continuam em Server Actions autenticadas e revalidam permissão no
servidor. Next.js compara Origin com Host/X-Forwarded-Host para Server Actions,
além dos cookies SameSite. Não foi adicionado token artesanal. Caso haja proxy
com outro host, cadastrar somente origens exatas em serverActions.allowedOrigins.

## IDOR

As páginas, API de grade e acesso a layout validam UUID, autenticação e
permissão; RLS repete a autorização. O modelo atual ainda não possui carteira
de vendedor/ownership por recurso. Antes de introduzi-la, criar uma função
central can_access_order(order_id) usada em RLS, páginas, APIs e Storage; não
espalhar uma regra parcial somente na interface.

## Retenção/LGPD

Não há exclusão automática. Recomenda-se definir com o encarregado/DPO prazo por
categoria de evento, base legal, exportação para arquivo imutável e processo de
legal hold. Qualquer expurgo futuro deve ser uma operação administrativa
excepcional, auditada e fora das credenciais cotidianas.

## Aplicação e validação em staging

1. Fazer backup do banco e confirmar o restore.
2. Aplicar a migration nova em staging.
3. Executar supabase/tests/lot3_security.sql.
4. Confirmar no dashboard que o bucket está privado e que anon não lista/baixa.
5. Abrir pedidos com layouts antigos usando usuário com orders.view.
6. Confirmar 403 com usuário sem orders.view e sem audit.view.
7. Exercitar criação/edição/cancelamento/publicação e conferir before/after.
8. Testar convite, login/logout, upload válido, MIME falso e arquivo acima do limite.
9. Executar npm audit --omit=dev, npm audit, npm run lint,
   npx tsc --noEmit, npm test e npm run build.

Sem credenciais/instância remota, os itens 2–8 ficam AGUARDANDO STAGING; os
testes locais e a migration ficam apenas PREPARADOS, nunca reportados como
execução real no Supabase.
