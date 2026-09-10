export const PERMISSION_DEFINITIONS = [
  { code: 'dashboard.view', name: 'Visualizar dashboard', module: 'dashboard' },
  { code: 'customers.view', name: 'Visualizar clientes', module: 'customers' },
  { code: 'customers.create', name: 'Criar clientes', module: 'customers' },
  { code: 'customers.update', name: 'Editar clientes', module: 'customers' },
  { code: 'customers.delete', name: 'Excluir clientes', module: 'customers' },
  { code: 'orders.view', name: 'Visualizar pedidos', module: 'orders' },
  { code: 'orders.create', name: 'Criar pedidos', module: 'orders' },
  { code: 'orders.update', name: 'Editar pedidos', module: 'orders' },
  { code: 'orders.cancel', name: 'Cancelar pedidos', module: 'orders' },
  { code: 'production.view', name: 'Visualizar produção', module: 'production' },
  { code: 'production.update', name: 'Atualizar produção', module: 'production' },
  { code: 'art.view', name: 'Visualizar artes', module: 'art' },
  { code: 'art.manage', name: 'Gerenciar artes e aprovações', module: 'art' },
  { code: 'inventory.view', name: 'Visualizar estoque', module: 'inventory' },
  { code: 'inventory.create', name: 'Cadastrar itens de estoque', module: 'inventory' },
  { code: 'inventory.update', name: 'Editar cadastro de estoque', module: 'inventory' },
  { code: 'inventory.adjust', name: 'Movimentar estoque', module: 'inventory' },
  { code: 'purchases.view', name: 'Visualizar compras', module: 'purchases' },
  { code: 'purchases.create', name: 'Criar compras', module: 'purchases' },
  { code: 'purchases.update', name: 'Editar compras', module: 'purchases' },
  { code: 'finance.view', name: 'Visualizar financeiro', module: 'finance' },
  { code: 'finance.create', name: 'Criar lançamentos financeiros', module: 'finance' },
  { code: 'finance.update', name: 'Editar financeiro', module: 'finance' },
  { code: 'workshops.view', name: 'Visualizar oficinas', module: 'workshops' },
  { code: 'workshops.update', name: 'Atualizar oficinas', module: 'workshops' },
  { code: 'settings.view', name: 'Visualizar configurações', module: 'settings' },
  { code: 'settings.manage', name: 'Gerenciar configurações', module: 'settings' },
  { code: 'users.view', name: 'Visualizar usuários', module: 'users' },
  { code: 'users.manage', name: 'Gerenciar usuários', module: 'users' },
  { code: 'roles.view', name: 'Visualizar papéis', module: 'roles' },
  { code: 'roles.manage', name: 'Gerenciar papéis', module: 'roles' },
  { code: 'audit.view', name: 'Visualizar auditoria', module: 'audit' },
  { code: 'crm.view', name: 'Visualizar CRM', module: 'crm' },
  { code: 'crm.create', name: 'Criar registros no CRM', module: 'crm' },
  { code: 'crm.update', name: 'Editar registros no CRM', module: 'crm' },
  { code: 'crm.delete', name: 'Excluir registros no CRM', module: 'crm' },
  { code: 'quotes.view', name: 'Visualizar orçamentos', module: 'quotes' },
  { code: 'quotes.create', name: 'Criar orçamentos', module: 'quotes' },
  { code: 'quotes.update', name: 'Editar orçamentos', module: 'quotes' },
  { code: 'quotes.approve', name: 'Aprovar orçamentos', module: 'quotes' },
] as const

export type PermissionCode = typeof PERMISSION_DEFINITIONS[number]['code']
export const PERMISSION_CODES = PERMISSION_DEFINITIONS.map(({ code }) => code) as PermissionCode[]

export const ROLE_DEFINITIONS = [
  { code: 'administrator', name: 'Administrador', description: 'Acesso total e administração do sistema.' },
  { code: 'manager', name: 'Gerente', description: 'Visão ampla comercial e operacional.' },
  { code: 'commercial', name: 'Comercial', description: 'Clientes, pipeline comercial e orçamentos.' },
  { code: 'salesperson', name: 'Vendedor', description: 'Carteira comercial, pedidos e orçamentos.' },
  { code: 'production', name: 'Produção', description: 'Pedidos, produção e oficinas sem dados financeiros.' },
  { code: 'inventory', name: 'Estoque', description: 'Materiais, movimentações e separação.' },
  { code: 'purchasing', name: 'Compras', description: 'Necessidades de compra e materiais.' },
  { code: 'finance', name: 'Financeiro', description: 'Recebimentos e configurações financeiras.' },
] as const

export type RoleCode = typeof ROLE_DEFINITIONS[number]['code']

const managerPermissions: PermissionCode[] = [
  'dashboard.view',
  'customers.view', 'customers.create', 'customers.update', 'customers.delete',
  'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
  'production.view', 'production.update', 'art.view', 'art.manage',
  'inventory.view', 'purchases.view', 'finance.view',
  'workshops.view', 'workshops.update',
  'crm.view', 'crm.create', 'crm.update', 'crm.delete',
  'quotes.view', 'quotes.create', 'quotes.update', 'quotes.approve',
  'audit.view',
]

export const INITIAL_ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  administrator: PERMISSION_CODES,
  manager: managerPermissions,
  commercial: [
    'dashboard.view',
    'customers.view', 'customers.create', 'customers.update',
    'orders.view', 'art.view', 'art.manage',
    'crm.view', 'crm.create', 'crm.update',
    'quotes.view', 'quotes.create', 'quotes.update',
  ],
  salesperson: [
    'customers.view', 'customers.create', 'customers.update',
    'orders.view', 'orders.create', 'art.view', 'art.manage',
    'crm.view', 'crm.create', 'crm.update',
    'quotes.view', 'quotes.create', 'quotes.update',
  ],
  production: [
    'orders.view',
    'production.view', 'production.update', 'art.view', 'art.manage',
    'workshops.view', 'workshops.update',
    'inventory.view',
  ],
  inventory: [
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust',
    'purchases.view', 'orders.view',
  ],
  purchasing: [
    'inventory.view',
    'purchases.view', 'purchases.create', 'purchases.update',
    'orders.view',
  ],
  finance: [
    'finance.view', 'finance.create', 'finance.update',
    'orders.view', 'customers.view',
  ],
}

export interface PermissionSnapshot {
  active: boolean
  permissions: readonly string[]
}

export function canAccess(snapshot: PermissionSnapshot | null, permission: PermissionCode) {
  return Boolean(snapshot?.active && snapshot.permissions.includes(permission))
}
