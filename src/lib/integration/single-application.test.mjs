import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('a zona comercial não usa proxy nem uma origem externa', async () => {
  const nextConfig = await read('../../../next.config.ts')
  const proxy = await read('../supabase/proxy.ts')

  assert.doesNotMatch(nextConfig, /DESKCOMM_COMMERCIAL_ORIGIN/)
  assert.doesNotMatch(nextConfig, /async rewrites\s*\(/)
  assert.doesNotMatch(proxy, /isCommercialZone/)
})

test('o manifesto do runtime rejeita domínios fabris do Deskcomm', async () => {
  const manifest = await read('../../features/commercial/runtime-manifest.ts')

  assert.match(manifest, /externalRuntimeRequired: false/)
  assert.match(manifest, /basePathRequired: false/)
  for (const domain of ['orders', 'production', 'inventory', 'finance', 'purchasing', 'quotes', 'pcp', 'bom']) {
    assert.match(manifest, new RegExp(`'${domain}'`))
  }
})

test('Inbox comercial é uma página local com fixtures e pedido somente leitura', async () => {
  const [page, inbox, fixtures] = await Promise.all([
    read('../../app/comercial/app/inbox/page.tsx'),
    read('../../features/commercial/inbox/CommercialInbox.tsx'),
    read('../../features/commercial/inbox/fixtures.ts'),
  ])

  assert.match(page, /requirePermission\('crm\.view'\)/)
  assert.match(page, /<CommercialInbox/)
  assert.match(inbox, /Pedido Selma · somente leitura/)
  assert.match(inbox, /aguardando providers e banco real/)
  assert.match(fixtures, /INBOX_CONVERSATION_FIXTURES/)
  assert.doesNotMatch(`${page}\n${inbox}\n${fixtures}`, /fetch\(|createClient\(|localhost:\d+/)
})

test('as rotas comerciais usam o mesmo guard de permissão da aplicação', async () => {
  const page = await read('../../app/comercial/app/[...slug]/page.tsx')

  assert.match(page, /requirePermission\(route\.permission\)/)
  assert.doesNotMatch(page, /\/comercial\/login/)
  assert.doesNotMatch(page, /window\.location/)
})

test('a navegação comercial permanece interna ao mesmo Next.js', async () => {
  const sidebar = await read('../../components/layout/SidebarNav.tsx')

  assert.match(sidebar, /<Link href=\{href\}/)
  assert.doesNotMatch(sidebar, /zone === 'deskcomm'/)
  assert.doesNotMatch(sidebar, /<a href=\{href\}/)
})

test('a identidade do produto apresenta comercial e operacional juntos', async () => {
  const [layout, sidebar, login] = await Promise.all([
    read('../../app/layout.tsx'),
    read('../../components/layout/Sidebar.tsx'),
    read('../../app/login/page.tsx'),
  ])

  assert.match(layout, /Gestão Comercial e Operacional/)
  assert.match(sidebar, /Comercial \+ Operacional/)
  assert.match(login, /Gestão Comercial e Operacional/)
})

test('agentes de IA usam uma tela local e uma consulta somente leitura', async () => {
  const [page, query, routeMap] = await Promise.all([
    read('../../app/comercial/app/ai/agents/page.tsx'),
    read('../supabase/queries/ai-agents.ts'),
    read('./commercial-route-map.ts'),
  ])

  assert.match(page, /requirePermission\('crm\.view'\)/)
  assert.match(page, /getAiAgentProfiles\(\)/)
  assert.match(page, /somente leitura/)
  assert.match(query, /\.from\('ai_agent_profiles'\)/)
  assert.match(query, /\.select\('slug,name,purpose,allowed_tools,enabled,updated_at'\)/)
  assert.doesNotMatch(query, /\.(insert|update|upsert|delete)\(/)
  assert.match(routeMap, /'ai\/agents':[\s\S]*?status: 'available'/)
})
