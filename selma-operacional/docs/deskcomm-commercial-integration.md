# Integração do Comercial DeskcommCRM

## Escopo

O sistema Selma continua responsável por dashboard, pedidos, produção, estoque,
compras, financeiro, cadastros e administração. O DeskcommCRM é servido como a
zona Comercial em `/comercial`, mantendo seu código e suas rotas originais.

A origem importada corresponde ao commit `1c9a46a180835cd21bcd74a732fba085df8f3e13`
do repositório DeskcommCRM. A licença MIT do projeto foi preservada em
`THIRD_PARTY_LICENSES` no checkout comercial.

## Execução local

- Selma operacional: `http://127.0.0.1:3100`
- DeskcommCRM: `http://127.0.0.1:3200/comercial`
- Origem configurada no Selma: `DESKCOMM_COMMERCIAL_ORIGIN=http://127.0.0.1:3200`
- Prefixo configurado no Deskcomm: `DESKCOMM_BASE_PATH=/comercial`

O `next.config.ts` do Selma encaminha `/comercial`, suas subrotas e assets para a
zona Deskcomm. A barra lateral do Selma usa links HTML para atravessar a fronteira
entre as duas aplicações, conforme o modelo de zonas do Next.js.

## Banco de dados

O login usa o mesmo projeto Supabase do Selma e foi validado. As telas autenticadas
do Deskcomm ainda exigem o schema próprio do produto. A primeira consulta bloqueada
é `public.platform_admins`; também foram observadas referências ausentes a
`public.api_audit_log` e `public.platform_branding`.

O baseline do Deskcomm possui 126 tabelas, enquanto o banco Selma possui 52. A
comparação de nomes encontrou colisões em `contacts` e `automation_rules`. Por isso,
o baseline não deve ser executado diretamente no banco em uso sem backup completo e
uma migration de compatibilidade que preserve as tabelas atuais.

## Validação atual

- Dashboard do Selma carregado com dados reais e fluxo de produção preservado.
- Menu Comercial aponta para Inbox, Radar, Agenda, Respostas rápidas, Funis,
  Contatos, Tarefas, IA, Canais, Análise e Configurações do Deskcomm.
- Login do Deskcomm acessível pela rota integrada.
- Lint e TypeScript passam nos dois projetos; o upstream Deskcomm mantém avisos de
  lint preexistentes, sem erros.
- Nenhuma migration do Deskcomm foi aplicada ao Supabase em uso.
- Nenhum commit ou push foi realizado nesta integração.
