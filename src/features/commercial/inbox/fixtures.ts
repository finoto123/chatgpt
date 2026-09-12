export interface InboxMessageFixture {
  id: string
  direction: 'incoming' | 'outgoing'
  body: string
  time: string
  status?: 'sent' | 'delivered' | 'read'
}

export interface InboxConversationFixture {
  id: string
  initials: string
  name: string
  company: string
  preview: string
  time: string
  unread: number
  queue: string
  channel: 'WhatsApp' | 'Instagram'
  state: 'queue' | 'mine' | 'closed'
  assignee: string | null
  opportunity: {
    title: string
    stage: string
    value: string
  }
  order: {
    number: string
    status: string
    deadline: string
  } | null
  messages: InboxMessageFixture[]
}

export const INBOX_CONVERSATION_FIXTURES: InboxConversationFixture[] = [
  {
    id: 'ana-martins',
    initials: 'AM',
    name: 'Ana Martins',
    company: 'Colégio Horizonte',
    preview: 'Consigo receber a proposta hoje?',
    time: '10:42',
    unread: 2,
    queue: 'Novos orçamentos',
    channel: 'WhatsApp',
    state: 'queue',
    assignee: null,
    opportunity: { title: '80 camisetas escolares', stage: 'Qualificação', value: 'R$ 6.480,00' },
    order: null,
    messages: [
      { id: 'm1', direction: 'incoming', body: 'Oi! Vocês conseguem produzir 80 camisetas para o mês que vem?', time: '10:31' },
      { id: 'm2', direction: 'outgoing', body: 'Olá, Ana! Consigo sim. Vou confirmar o prazo e preparar o orçamento para você.', time: '10:36', status: 'read' },
      { id: 'm3', direction: 'incoming', body: 'Consigo receber a proposta hoje?', time: '10:42' },
    ],
  },
  {
    id: 'rafael-costa',
    initials: 'RC',
    name: 'Rafael Costa',
    company: 'Academia Movimento',
    preview: 'Perfeito, vou confirmar as quantidades.',
    time: '09:58',
    unread: 0,
    queue: 'Carteira comercial',
    channel: 'WhatsApp',
    state: 'mine',
    assignee: 'Gabriela',
    opportunity: { title: 'Uniformes da equipe', stage: 'Proposta', value: 'R$ 12.920,00' },
    order: { number: 'PED-1048', status: 'Em produção', deadline: '25/09/2026' },
    messages: [
      { id: 'm4', direction: 'outgoing', body: 'Enviei a grade sugerida e o resumo da proposta.', time: '09:44', status: 'delivered' },
      { id: 'm5', direction: 'incoming', body: 'Perfeito, vou confirmar as quantidades.', time: '09:58' },
    ],
  },
  {
    id: 'joana-silva',
    initials: 'JS',
    name: 'Joana Silva',
    company: 'Clínica Bem Viver',
    preview: 'Bom dia! Preciso de um orçamento.',
    time: 'Ontem',
    unread: 1,
    queue: 'Novos orçamentos',
    channel: 'Instagram',
    state: 'queue',
    assignee: null,
    opportunity: { title: 'Jalecos personalizados', stage: 'Entrada', value: 'A calcular' },
    order: null,
    messages: [
      { id: 'm6', direction: 'incoming', body: 'Bom dia! Preciso de um orçamento para jalecos bordados.', time: 'Ontem, 16:21' },
    ],
  },
  {
    id: 'marcos-brasil',
    initials: 'MB',
    name: 'Marcos Brasil',
    company: 'Brasil Serviços',
    preview: 'Obrigado pelo retorno.',
    time: 'Ter',
    unread: 0,
    queue: 'Pós-venda',
    channel: 'WhatsApp',
    state: 'closed',
    assignee: 'Gabriela',
    opportunity: { title: 'Reposição de uniformes', stage: 'Ganho', value: 'R$ 3.240,00' },
    order: { number: 'PED-1029', status: 'Finalizado', deadline: 'Entregue em 08/09/2026' },
    messages: [
      { id: 'm7', direction: 'outgoing', body: 'O pedido foi entregue. Posso ajudar em mais alguma coisa?', time: 'Ter, 14:10', status: 'read' },
      { id: 'm8', direction: 'incoming', body: 'Obrigado pelo retorno.', time: 'Ter, 14:22' },
    ],
  },
]
