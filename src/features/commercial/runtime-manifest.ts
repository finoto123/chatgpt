export const COMMERCIAL_RUNTIME = {
  application: 'selmabordados-1',
  namespace: '/comercial',
  loginPath: '/login',
  apiNamespace: '/api',
  externalRuntimeRequired: false,
  basePathRequired: false,
} as const

export const DESKCOMM_MODULES_ALLOWED = [
  'atendimento',
  'inbox',
  'whatsapp',
  'conversations',
  'messages',
  'attachments',
  'realtime-abstraction',
  'queues',
  'assignment',
  'transfer',
  'handoff',
  'templates',
  'channel-adapters',
  'conversational-automation',
  'service-ai',
] as const
export const DESKCOMM_MODULES_REJECTED_AS_SOURCE_OF_TRUTH = [
  'orders',
  'production',
  'inventory',
  'finance',
  'purchasing',
  'quotes',
  'pcp',
  'bom',
  'technical-sheet',
  'factory-domain',
] as const

export const SELMA_OWNED_DOMAINS = [
  'customers',
  'quotes',
  'proposals',
  'orders',
  'art',
  'technical-sheet',
  'bom',
  'inventory',
  'purchasing',
  'pcp',
  'production',
  'finance',
  'future-fiscal',
] as const
