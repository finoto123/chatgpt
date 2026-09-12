'use client'

import {
  ArrowLeft,
  CheckCheck,
  ChevronRight,
  Clock3,
  Inbox,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  INBOX_CONVERSATION_FIXTURES,
  type InboxConversationFixture,
} from './fixtures'

type InboxFilter = 'queue' | 'mine' | 'closed'
type MobilePane = 'list' | 'conversation'

const FILTERS: Array<{ value: InboxFilter; label: string }> = [
  { value: 'queue', label: 'Fila' },
  { value: 'mine', label: 'Minhas' },
  { value: 'closed', label: 'Fechadas' },
]

export function CommercialInbox() {
  const [filter, setFilter] = useState<InboxFilter>('queue')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(INBOX_CONVERSATION_FIXTURES[0].id)
  const [mobilePane, setMobilePane] = useState<MobilePane>('list')

  const visibleConversations = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return INBOX_CONVERSATION_FIXTURES.filter((conversation) => {
      const matchesFilter = conversation.state === filter
      const haystack = `${conversation.name} ${conversation.company} ${conversation.preview}`
        .toLocaleLowerCase('pt-BR')
      return matchesFilter && (!term || haystack.includes(term))
    })
  }, [filter, search])

  const selected = INBOX_CONVERSATION_FIXTURES.find(({ id }) => id === selectedId)
    ?? visibleConversations[0]
    ?? INBOX_CONVERSATION_FIXTURES[0]

  function selectConversation(id: string) {
    setSelectedId(id)
    setMobilePane('conversation')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <span className="inline-flex items-center gap-2 font-medium">
          <ShieldCheck size={14} aria-hidden="true" />
          APP-1 local · um runtime e uma sessão Selma
        </span>
        <span>🧪 Dados de fixture — aguardando providers e banco real</span>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(260px,330px)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,330px)_minmax(360px,1fr)_300px]">
        <ConversationList
          conversations={visibleConversations}
          selectedId={selected.id}
          filter={filter}
          search={search}
          hiddenOnMobile={mobilePane === 'conversation'}
          onFilter={setFilter}
          onSearch={setSearch}
          onSelect={selectConversation}
        />
        <ConversationThread
          conversation={selected}
          hiddenOnMobile={mobilePane === 'list'}
          onBack={() => setMobilePane('list')}
        />
        <CommercialContext conversation={selected} />
      </div>
    </div>
  )
}

function ConversationList({
  conversations,
  selectedId,
  filter,
  search,
  hiddenOnMobile,
  onFilter,
  onSearch,
  onSelect,
}: {
  conversations: InboxConversationFixture[]
  selectedId: string
  filter: InboxFilter
  search: string
  hiddenOnMobile: boolean
  onFilter: (filter: InboxFilter) => void
  onSearch: (value: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <section className={`${hiddenOnMobile ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r`} style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }} aria-label="Conversas">
      <div className="border-b p-4" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Conversas</h2>
            <p className="text-xs text-muted">Atendimento centralizado</p>
          </div>
          <span className="grid size-9 place-items-center rounded-lg bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
            <Inbox size={18} aria-hidden="true" />
          </span>
        </div>
        <label className="relative mt-4 block">
          <span className="sr-only">Buscar conversa</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="crm-control pl-9" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar conversa" />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-surface-hover p-1">
          {FILTERS.map((item) => {
            const count = INBOX_CONVERSATION_FIXTURES.filter(({ state }) => state === item.value).length
            return (
              <button key={item.value} type="button" onClick={() => onFilter(item.value)} className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${filter === item.value ? 'bg-[var(--card-bg)] text-green-700 shadow-sm dark:text-green-300' : 'text-muted hover:text-[var(--fg)]'}`}>
                {item.label} {count}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <button key={conversation.id} type="button" onClick={() => onSelect(conversation.id)} className="w-full border-b p-4 text-left transition hover:bg-surface-hover" style={selectedId === conversation.id ? { background: 'var(--brand-green-dim)', borderColor: 'var(--border-subtle)' } : { borderColor: 'var(--border-subtle)' }}>
            <div className="flex gap-3">
              <Avatar conversation={conversation} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <strong className="truncate text-sm">{conversation.name}</strong>
                  <span className="shrink-0 text-[10px] text-muted">{conversation.time}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted">{conversation.company} · {conversation.channel}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted">{conversation.preview}</span>
                  {conversation.unread > 0 && <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-green-600 px-1 text-[10px] font-bold text-white">{conversation.unread}</span>}
                </div>
              </div>
            </div>
          </button>
        ))}
        {conversations.length === 0 && <div className="px-5 py-12 text-center text-sm text-muted">Nenhuma conversa neste filtro.</div>}
      </div>
    </section>
  )
}

function ConversationThread({ conversation, hiddenOnMobile, onBack }: { conversation: InboxConversationFixture; hiddenOnMobile: boolean; onBack: () => void }) {
  return (
    <section className={`${hiddenOnMobile ? 'hidden lg:flex' : 'flex'} min-h-0 min-w-0 flex-col`} style={{ background: 'var(--bg)' }} aria-label={`Conversa com ${conversation.name}`}>
      <header className="flex items-center justify-between gap-3 border-b bg-[var(--card-bg)] px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="grid size-9 place-items-center rounded-lg hover:bg-surface-hover lg:hidden" onClick={onBack} aria-label="Voltar para conversas"><ArrowLeft size={18} /></button>
          <Avatar conversation={conversation} compact />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{conversation.name}</h2>
            <p className="truncate text-xs text-muted">{conversation.channel} · {conversation.queue}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled title="Disponível na APP-8" className="hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium opacity-60 sm:inline-flex" style={{ borderColor: 'var(--border-color)' }}><UserRoundCheck size={15} />{conversation.assignee ? conversation.assignee : 'Assumir'}</button>
          <button type="button" disabled title="Disponível nas próximas fases APP" className="grid size-9 place-items-center rounded-lg border opacity-60" style={{ borderColor: 'var(--border-color)' }} aria-label="Mais ações"><MoreHorizontal size={17} /></button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        <div className="text-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Hoje</div>
        {conversation.messages.map((message) => (
          <div key={message.id} className={`flex ${message.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[72%] ${message.direction === 'outgoing' ? 'rounded-tr-sm bg-green-100 text-green-950 dark:bg-green-950 dark:text-green-100' : 'rounded-tl-sm border bg-[var(--card-bg)]'}`} style={message.direction === 'incoming' ? { borderColor: 'var(--border-subtle)' } : undefined}>
              <p className="leading-6">{message.body}</p>
              <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">{message.time}{message.direction === 'outgoing' && <CheckCheck size={12} />}</span>
            </div>
          </div>
        ))}
      </div>

      <footer className="border-t bg-[var(--card-bg)] p-3 sm:p-4" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-end gap-2 rounded-xl border p-2" style={{ borderColor: 'var(--border-color)' }}>
          <button type="button" disabled title="Disponível na APP-8" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted opacity-60" aria-label="Anexar arquivo"><Paperclip size={18} /></button>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Mensagem</span>
            <textarea className="max-h-28 min-h-9 w-full resize-none bg-transparent px-2 py-2 text-sm outline-none" placeholder="Escreva uma mensagem…" disabled />
          </label>
          <button type="button" disabled className="grid size-9 shrink-0 place-items-center rounded-lg bg-green-600 text-white opacity-60" aria-label="Enviar mensagem"><Send size={16} /></button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted">Envio será habilitado pelo MessagingProvider na APP-8.</p>
      </footer>
    </section>
  )
}

function CommercialContext({ conversation }: { conversation: InboxConversationFixture }) {
  return (
    <aside className="hidden min-h-0 overflow-y-auto border-l bg-[var(--card-bg)] p-5 xl:block" style={{ borderColor: 'var(--border-color)' }} aria-label="Contexto comercial">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Contexto comercial</p>
      <div className="mt-5 flex items-center gap-3"><Avatar conversation={conversation} /><div className="min-w-0"><strong className="block truncate text-sm">{conversation.name}</strong><span className="block truncate text-xs text-muted">{conversation.company}</span></div></div>

      <section className="mt-6 rounded-xl bg-surface-hover p-4">
        <p className="text-xs text-muted">Oportunidade ativa</p>
        <h3 className="mt-1 font-semibold">{conversation.opportunity.title}</h3>
        <div className="mt-4 flex items-center justify-between text-xs"><span className="text-muted">Etapa</span><strong className="text-green-700 dark:text-green-300">{conversation.opportunity.stage}</strong></div>
        <div className="mt-2 flex items-center justify-between text-xs"><span className="text-muted">Valor</span><strong>{conversation.opportunity.value}</strong></div>
      </section>

      <section className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2 text-xs font-semibold"><Clock3 size={14} />Pedido Selma · somente leitura</div>
        {conversation.order ? <div className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><span className="text-muted">Número</span><strong>{conversation.order.number}</strong></div><div className="flex justify-between"><span className="text-muted">Status</span><strong>{conversation.order.status}</strong></div><div className="flex justify-between gap-3"><span className="text-muted">Prazo</span><strong className="text-right">{conversation.order.deadline}</strong></div></div> : <p className="mt-3 text-xs leading-5 text-muted">Ainda não há pedido. O próximo passo é criar um orçamento no domínio Selma.</p>}
      </section>

      <Link href="/crm" className="mt-4 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition hover:bg-surface-hover" style={{ borderColor: 'var(--border-color)' }}>
        Abrir CRM Selma <ChevronRight size={16} />
      </Link>
      <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-xs leading-5 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">O atendimento pode consultar número, status e prazo. Ações de fábrica, estoque e financeiro não fazem parte deste módulo.</p>
    </aside>
  )
}

function Avatar({ conversation, compact = false }: { conversation: InboxConversationFixture; compact?: boolean }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-green-600 to-emerald-500 font-bold text-white ${compact ? 'size-9 text-[10px]' : 'size-10 text-xs'}`}>{conversation.initials}</span>
}
