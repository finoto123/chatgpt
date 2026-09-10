import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(path) {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
}

function functionBody(fileSource, functionName) {
  const start = fileSource.indexOf(`export async function ${functionName}`)
  assert.notEqual(start, -1, `função ${functionName} não encontrada`)
  const next = fileSource.indexOf('export async function ', start + 1)
  return fileSource.slice(start, next === -1 ? undefined : next)
}

const pagePermissions = {
  'src/app/dashboard/page.tsx': 'dashboard.view',
  'src/app/clientes/page.tsx': 'customers.view',
  'src/app/clientes/[id]/page.tsx': 'customers.view',
  'src/app/pedidos/page.tsx': 'orders.view',
  'src/app/pedidos/[id]/page.tsx': 'orders.view',
  'src/app/pedidos/[id]/imprimir/page.tsx': 'orders.view',
  'src/app/producao/page.tsx': 'production.view',
  'src/app/sublimacao/page.tsx': 'production.view',
  'src/app/dtf/page.tsx': 'production.view',
  'src/app/bordados/page.tsx': 'production.view',
  'src/app/acabamento/page.tsx': 'production.view',
  'src/app/oficinas/page.tsx': 'workshops.view',
  'src/app/estoque/page.tsx': 'inventory.view',
  'src/app/compras/page.tsx': 'purchases.view',
  'src/app/financeiro/page.tsx': 'finance.view',
  'src/app/cadastros/page.tsx': 'settings.view',
  'src/app/configuracoes/usuarios/page.tsx': 'users.view',
  'src/app/configuracoes/permissoes/page.tsx': 'roles.manage',
  'src/app/configuracoes/auditoria/page.tsx': 'audit.view',
}

const actionPermissions = {
  'src/app/acabamento/actions.ts': { moverAcabamento: 'production.update' },
  'src/app/bordados/actions.ts': { updateBordadoStatusAction: 'production.update' },
  'src/app/cadastros/actions.ts': {
    criarOficina: 'settings.manage',
    atualizarOficina: 'settings.manage',
    criarVendedor: 'settings.manage',
    atualizarVendedor: 'settings.manage',
    criarFeriado: 'settings.manage',
    deletarRegistro: 'settings.manage',
  },
  'src/app/clientes/actions.ts': {
    criarCliente: 'customers.create',
    atualizarCliente: 'customers.update',
    deletarCliente: 'customers.delete',
  },
  'src/app/dashboard/actions.ts': {
    getPedidosAtrasados: 'dashboard.view',
    moverParaCorte: 'production.update',
    moverParaEstamparia: 'production.update',
    moverParaCostura: 'production.update',
    moverParaAcabamento: 'production.update',
  },
  'src/app/dtf/actions.ts': {
    registrarEnvioDtf: 'production.update',
    atualizarStatusDtf: 'production.update',
    finalizarDtf: 'production.update',
  },
  'src/app/estoque/actions.ts': {
    editarTecido: 'inventory.update',
    registrarMovimentacao: 'inventory.adjust',
  },
  'src/app/oficinas/actions.ts': {
    registrarEnvio: 'workshops.update',
    confirmarRetorno: 'workshops.update',
  },
  'src/app/pedidos/actions.ts': {
    gerarProximoNumeroPedido: 'orders.create',
    atualizarStatusPedido: 'orders.update',
    atualizarCorte: 'production.update',
    salvarEmbalagem: 'production.update',
    marcarComoEntregue: 'production.update',
    publicarRascunho: 'orders.update',
    registrarPagamento: 'finance.update',
    restaurarPedido: 'orders.update',
    cancelarPedido: 'orders.cancel',
  },
  'src/app/producao/actions.ts': { atualizarDadosCorte: 'production.update' },
  'src/app/sublimacao/actions.ts': { atualizarSublimacao: 'production.update' },
  'src/app/configuracoes/usuarios/actions.ts': {
    inviteUserAction: 'users.manage',
    setUserActiveAction: 'users.manage',
    setUserRolesAction: 'users.manage',
  },
  'src/app/configuracoes/permissoes/actions.ts': {
    setRolePermissionAction: 'roles.manage',
  },
}

test('ações mutáveis exigem a permissão específica no servidor', () => {
  for (const [path, functions] of Object.entries(actionPermissions)) {
    const fileSource = source(path)
    for (const [name, permission] of Object.entries(functions)) {
      assert.ok(
        functionBody(fileSource, name).includes(`requirePermission('${permission}')`),
        `${name} deve exigir ${permission}`
      )
    }
  }
})

test('criação/edição dinâmica de pedido decide a permissão após validar o payload', () => {
  const fileSource = source('src/app/pedidos/actions.ts')
  for (const name of ['criarPedido', 'salvarRascunho']) {
    const body = functionBody(fileSource, name)
    assert.match(body, /requireUser\(\)/)
    assert.match(body, /requirePermission\(parsed\.data\.id \? 'orders\.update' : 'orders\.create'\)/)
  }
  assert.match(functionBody(fileSource, 'uploadLayoutPedido'), /requireAnyPermission\(\['orders\.create', 'orders\.update'\]\)/)
})

test('edição de pedido envia ao schema somente os campos do formulário', () => {
  const drawer = source('src/components/pedidos/NovoPedidoDrawer.tsx')
  const mapperStart = drawer.indexOf('function pedidoToFormValues')
  const componentStart = drawer.indexOf('export function NovoPedidoDrawer')
  const mapper = drawer.slice(mapperStart, componentStart)
  assert.notEqual(mapperStart, -1)
  assert.doesNotMatch(mapper, /\.\.\.pedido/)
  assert.doesNotMatch(mapper, /\.\.\.item/)
  assert.match(drawer, /defaultValues: pedidoInicial \? pedidoToFormValues\(pedidoInicial\)/)
})

test('API de grade diferencia 401 e 403 e exige orders.view', () => {
  const route = source('src/app/api/pedidos/[id]/grade/route.ts')
  assert.match(route, /checkPermission\('orders\.view'\)/)
  assert.match(route, /status === 401/)
  assert.match(route, /status: permission\.status/)
  assert.match(route, /NextResponse\.json\(\{ grade, total \}\)/)
})

test('API de layout privado diferencia 401/403 e emite somente signed URL', () => {
  const route = source('src/app/api/pedidos/[id]/layout/route.ts')
  assert.match(route, /checkPermission\('orders\.view'\)/)
  assert.match(route, /status === 401/)
  assert.match(route, /createSignedLayoutUrlForOrder/)
  assert.doesNotMatch(route, /getPublicUrl/)
})

test('proxy de impressão valida permissão e RLS antes de baixar layout privado', () => {
  const route = source('src/app/api/pedidos/[id]/layout/file/route.ts')
  assert.match(route, /checkPermission\('orders\.view'\)/)
  assert.match(route, /createServerSupabaseClient/)
  assert.match(route, /\.from\('pedidos'\)/)
  assert.match(route, /createAdminSupabaseClient/)
  assert.match(route, /\.download\(storagePath\)/)
  assert.doesNotMatch(route, /getPublicUrl/)
})

test('migration remove baseline ampla e não cria authenticated FOR ALL', () => {
  const migration = source('supabase/migrations/202609060002_rbac_and_granular_rls.sql')
  assert.match(migration, /DROP POLICY IF EXISTS authenticated_access_baseline ON public\.pedidos/)
  assert.doesNotMatch(migration, /CREATE POLICY[\s\S]{0,180}FOR ALL TO authenticated/i)
  assert.match(migration, /REVOKE ALL ON public\.profiles, public\.roles, public\.permissions/)
  assert.match(migration, /CREATE POLICY configuracoes_financeiro_select_authorized[\s\S]*finance\.view/)
  assert.match(migration, /CREATE POLICY movimentacoes_estoque_insert_authorized[\s\S]*inventory\.adjust/)
})

test('somente fluxos administrativos aprovados importam o cliente admin', () => {
  const upload = source('src/app/pedidos/actions.ts')
  const users = source('src/app/configuracoes/usuarios/actions.ts')
  assert.match(upload, /createAdminSupabaseClient/)
  assert.match(upload, /requireAnyPermission/)
  assert.match(users, /createAdminSupabaseClient/)
  assert.match(users, /requirePermission\('users\.manage'\)/)
})

test('paginas privadas exigem permissao no servidor antes de consultar dados', () => {
  for (const [path, permission] of Object.entries(pagePermissions)) {
    const fileSource = source(path)
    assert.ok(
      fileSource.includes(`requirePermission('${permission}')`),
      `${path} deve exigir ${permission}`
    )
  }
})

test('helper central bloqueia anonimo e perfil inativo', () => {
  const helper = source('src/lib/auth/require-user.ts')
  assert.match(helper, /supabase\.auth\.getUser\(\)/)
  assert.match(helper, /if \(!state\.user\)[\s\S]*redirect\(`/)
  assert.match(helper, /if \(!state\.context\?\.profile\.active\)[\s\S]*acesso-desativado/)
  assert.match(helper, /const getAuthorizationState = cache\(/)
})
