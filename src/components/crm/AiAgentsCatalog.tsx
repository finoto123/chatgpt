'use client'

import { Bot, Search, ShieldCheck, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AiAgentProfile } from '@/lib/supabase/queries/ai-agents'

interface AiAgentsCatalogProps {
  agents: AiAgentProfile[]
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AiAgentsCatalog({ agents }: AiAgentsCatalogProps) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all')

  const visibleAgents = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')

    return agents.filter((agent) => {
      const matchesStatus = status === 'all'
        || (status === 'enabled' && agent.enabled)
        || (status === 'disabled' && !agent.enabled)
      const searchableText = `${agent.name} ${agent.purpose} ${agent.slug} ${agent.allowedTools.join(' ')}`
        .toLocaleLowerCase('pt-BR')
      return matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch))
    })
  }, [agents, search, status])

  const enabledCount = agents.filter((agent) => agent.enabled).length

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo dos agentes">
        <SummaryCard label="Agentes cadastrados" value={agents.length} icon={<Bot size={18} />} />
        <SummaryCard label="Agentes ativos" value={enabledCount} icon={<ShieldCheck size={18} />} />
        <SummaryCard
          label="Ferramentas vinculadas"
          value={new Set(agents.flatMap((agent) => agent.allowedTools)).size}
          icon={<Wrench size={18} />}
        />
      </section>

      <section className="crm-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar agente</span>
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              className="crm-control pl-9"
              placeholder="Buscar por nome, função ou ferramenta"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="sm:w-52">
            <span className="sr-only">Filtrar por status</span>
            <select
              className="crm-control"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="all">Todos os status</option>
              <option value="enabled">Ativos</option>
              <option value="disabled">Inativos</option>
            </select>
          </label>
        </div>
      </section>

      {visibleAgents.length === 0 ? (
        <section className="crm-card px-6 py-12 text-center">
          <Bot size={30} className="mx-auto text-muted" aria-hidden="true" />
          <h3 className="mt-3 font-semibold">Nenhum agente encontrado</h3>
          <p className="mt-1 text-sm text-muted">Ajuste a busca ou o filtro selecionado.</p>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2" aria-live="polite">
          {visibleAgents.map((agent) => (
            <article key={agent.slug} className="crm-card crm-card-interactive p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                    <Bot size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{agent.name}</h3>
                    <p className="mt-0.5 text-xs text-muted">{agent.slug}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  agent.enabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}>
                  {agent.enabled ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <p className="mt-4 min-h-12 text-sm leading-6 text-muted">{agent.purpose}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {agent.allowedTools.length > 0 ? agent.allowedTools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--surface-subtle)' }}
                  >
                    {tool}
                  </span>
                )) : (
                  <span className="text-xs text-muted">Sem ferramentas vinculadas</span>
                )}
              </div>

              <p className="mt-4 border-t pt-3 text-xs text-muted" style={{ borderColor: 'var(--border-subtle)' }}>
                Atualizado em {formatUpdatedAt(agent.updatedAt)}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <article className="crm-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          {icon}
        </span>
      </div>
    </article>
  )
}
