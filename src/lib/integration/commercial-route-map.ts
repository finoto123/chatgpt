import type { PermissionCode } from '@/lib/auth/rbac'

export interface CommercialRouteDefinition {
  title: string
  description: string
  destination?: string
  permission: PermissionCode
  status: 'available' | 'implemented-awaiting-database' | 'planned'
  phase: 'APP-1' | 'APP-5' | 'APP-8' | 'APP-12'
}

export const COMMERCIAL_ROUTE_MAP = {
  inbox: {
    title: 'Inbox comercial',
    description: 'Atendimento centralizado e histórico das conversas comerciais.',
    permission: 'crm.view',
    status: 'implemented-awaiting-database',
    phase: 'APP-1',
  },
  radar: {
    title: 'Radar comercial',
    description: 'Visão consolidada das oportunidades e próximos passos.',
    destination: '/crm',
    permission: 'crm.view',
    status: 'available',
    phase: 'APP-1',
  },
  agenda: {
    title: 'Agenda comercial',
    description: 'Tarefas e retornos pendentes do time comercial.',
    destination: '/tarefas',
    permission: 'crm.view',
    status: 'available',
    phase: 'APP-1',
  },
  templates: {
    title: 'Respostas rápidas',
    description: 'Modelos de mensagens para atendimento.',
    permission: 'crm.view',
    status: 'planned',
    phase: 'APP-8',
  },
  kanban: {
    title: 'Funil comercial',
    description: 'Pipeline de oportunidades em formato Kanban.',
    destination: '/crm/funil',
    permission: 'crm.view',
    status: 'available',
    phase: 'APP-1',
  },
  contacts: {
    title: 'Contatos',
    description: 'Cadastro único de clientes e contatos.',
    destination: '/clientes',
    permission: 'customers.view',
    status: 'available',
    phase: 'APP-1',
  },
  tasks: {
    title: 'Tarefas',
    description: 'Fila de atividades do usuário conectado.',
    destination: '/tarefas',
    permission: 'crm.view',
    status: 'available',
    phase: 'APP-1',
  },
  crm: {
    title: 'CRM',
    description: 'Central comercial completa.',
    destination: '/crm',
    permission: 'crm.view',
    status: 'available',
    phase: 'APP-1',
  },
  metrics: {
    title: 'Desempenho comercial',
    description: 'Indicadores e análise do funil.',
    destination: '/crm/analytics',
    permission: 'crm.view',
    status: 'available',
    phase: 'APP-1',
  },
  activities: {
    title: 'Atividades',
    description: 'Linha do tempo de interações comerciais.',
    destination: '/crm',
    permission: 'crm.view',
    status: 'available',
    phase: 'APP-1',
  },
  analise: {
    title: 'Análise comercial',
    description: 'Indicadores, metas e previsões de vendas.',
    destination: '/crm/analytics',
    permission: 'crm.view',
    status: 'available',
    phase: 'APP-1',
  },
  settings: {
    title: 'Configurações comerciais',
    description: 'Regras, metas, estágios e parâmetros comerciais.',
    destination: '/configuracoes/comercial',
    permission: 'settings.view',
    status: 'available',
    phase: 'APP-1',
  },
  connections: {
    title: 'Conexões',
    description: 'Canais de atendimento e WhatsApp.',
    permission: 'settings.view',
    status: 'planned',
    phase: 'APP-8',
  },
  webhooks: {
    title: 'Webhooks',
    description: 'Integrações de entrada e saída do CRM.',
    permission: 'settings.view',
    status: 'planned',
    phase: 'APP-5',
  },
  'ads/meta': {
    title: 'Meta Ads',
    description: 'Origem e desempenho dos leads de campanhas.',
    permission: 'crm.view',
    status: 'planned',
    phase: 'APP-5',
  },
  ai: {
    title: 'Agente de IA',
    description: 'Automação assistida do atendimento comercial.',
    permission: 'crm.view',
    status: 'planned',
    phase: 'APP-12',
  },
  'ai/agents': {
    title: 'Agentes de IA',
    description: 'Configuração dos agentes comerciais.',
    permission: 'crm.view',
    status: 'available',
    phase: 'APP-12',
  },
  'ai/followups': {
    title: 'Follow-ups automáticos',
    description: 'Cadências e retornos automáticos.',
    permission: 'crm.view',
    status: 'planned',
    phase: 'APP-12',
  },
  'ai/routers': {
    title: 'Roteadores de IA',
    description: 'Distribuição das conversas e intenções.',
    permission: 'crm.view',
    status: 'planned',
    phase: 'APP-12',
  },
} as const satisfies Record<string, CommercialRouteDefinition>

export type CommercialRouteKey = keyof typeof COMMERCIAL_ROUTE_MAP

export function resolveCommercialRoute(
  segments: readonly string[]
): CommercialRouteDefinition | null {
  const key = segments.join('/') as CommercialRouteKey
  return COMMERCIAL_ROUTE_MAP[key] ?? null
}
