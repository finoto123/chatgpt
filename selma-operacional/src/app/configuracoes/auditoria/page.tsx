import Link from 'next/link'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-user'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const PAGE_SIZE = 25
const filtersSchema = z.object({
  user: z.string().uuid().optional().catch(undefined),
  action: z.string().trim().max(120).optional().catch(undefined),
  module: z.string().trim().max(120).optional().catch(undefined),
  entity: z.string().trim().max(255).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(100000).default(1).catch(1),
}).strict()

function summarize(oldValues: unknown, newValues: unknown) {
  if (!oldValues && newValues) return 'Registro criado'
  if (oldValues && !newValues) return 'Registro removido'
  if (!oldValues || !newValues || typeof oldValues !== 'object' || typeof newValues !== 'object') {
    return 'Evento registrado'
  }
  const before = oldValues as Record<string, unknown>
  const after = newValues as Record<string, unknown>
  const changed = Object.keys({ ...before, ...after })
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .slice(0, 5)
  return changed.length ? `Alterado: ${changed.join(', ')}` : 'Evento registrado'
}

function pageHref(filters: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  params.set('page', String(page))
  return `/configuracoes/auditoria?${params.toString()}`
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission('audit.view')
  const raw = await searchParams
  const single = Object.fromEntries(Object.entries(raw).map(([key, value]) => [
    key,
    Array.isArray(value) ? value[0] : value,
  ]))
  const filters = filtersSchema.parse(single)
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('audit_logs')
    .select('id, user_id, action, entity_type, entity_id, old_values, new_values, metadata, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })

  if (filters.user) query = query.eq('user_id', filters.user)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.module) query = query.eq('entity_type', filters.module)
  if (filters.entity) query = query.ilike('entity_id', `%${filters.entity.replace(/[%_,()]/g, '')}%`)
  if (filters.from) query = query.gte('created_at', filters.from + 'T00:00:00-03:00')
  if (filters.to) query = query.lte('created_at', filters.to + 'T23:59:59.999-03:00')

  const start = (filters.page - 1) * PAGE_SIZE
  const [{ data: logs, count, error }, profilesResult] = await Promise.all([
    query.range(start, start + PAGE_SIZE - 1),
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
  ])
  if (error) throw new Error('Não foi possível carregar os registros de auditoria.')

  const profiles = profilesResult.data ?? []
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const persistedFilters = {
    user: filters.user,
    action: filters.action,
    module: filters.module,
    entity: filters.entity,
    from: filters.from,
    to: filters.to,
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Auditoria</h1>
        <p className="text-sm text-muted mt-1">Histórico append-only de operações críticas.</p>
      </div>

      <form className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3 xl:grid-cols-6">
        <select name="user" defaultValue={filters.user ?? ''} className="rounded-lg border border-border bg-input px-3 py-2 text-sm">
          <option value="">Todos os usuários</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.full_name || profile.email || profile.id}</option>
          ))}
        </select>
        <input name="action" defaultValue={filters.action} placeholder="Ação exata" className="rounded-lg border border-border bg-input px-3 py-2 text-sm" />
        <input name="module" defaultValue={filters.module} placeholder="Módulo/entidade" className="rounded-lg border border-border bg-input px-3 py-2 text-sm" />
        <input name="entity" defaultValue={filters.entity} placeholder="ID da entidade" className="rounded-lg border border-border bg-input px-3 py-2 text-sm" />
        <input type="date" name="from" defaultValue={filters.from} className="rounded-lg border border-border bg-input px-3 py-2 text-sm" />
        <input type="date" name="to" defaultValue={filters.to} className="rounded-lg border border-border bg-input px-3 py-2 text-sm" />
        <div className="flex gap-2 md:col-span-3 xl:col-span-6">
          <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white">Filtrar</button>
          <Link href="/configuracoes/auditoria" className="rounded-lg border border-border px-4 py-2 text-sm">Limpar</Link>
        </div>
      </form>

      {!logs?.length ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted">
          Nenhum registro de auditoria encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Data/hora</th><th className="p-3">Usuário</th>
                <th className="p-3">Ação</th><th className="p-3">Módulo</th>
                <th className="p-3">ID</th><th className="p-3">Resumo</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const profile = log.user_id ? profileMap.get(log.user_id) : null
                return (
                  <tr key={log.id} className="border-b border-border align-top last:border-0">
                    <td className="whitespace-nowrap p-3">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td className="p-3">{profile?.full_name || profile?.email || log.user_id || 'Sistema'}</td>
                    <td className="p-3 font-medium">{log.action}</td>
                    <td className="p-3">{log.entity_type}</td>
                    <td className="max-w-44 break-all p-3">{log.entity_id || '—'}</td>
                    <td className="min-w-64 p-3">
                      <details>
                        <summary className="cursor-pointer">{summarize(log.old_values, log.new_values)}</summary>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <pre className="max-h-80 overflow-auto rounded-lg bg-black/5 p-3 text-xs dark:bg-white/5">Antes{String.fromCharCode(10)}{JSON.stringify(log.old_values, null, 2) || '—'}</pre>
                          <pre className="max-h-80 overflow-auto rounded-lg bg-black/5 p-3 text-xs dark:bg-white/5">Depois{String.fromCharCode(10)}{JSON.stringify(log.new_values, null, 2) || '—'}</pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span>{count ?? 0} registro(s) · página {filters.page} de {totalPages}</span>
        <div className="flex gap-2">
          {filters.page > 1 && <Link className="rounded border border-border px-3 py-1.5" href={pageHref(persistedFilters, filters.page - 1)}>Anterior</Link>}
          {filters.page < totalPages && <Link className="rounded border border-border px-3 py-1.5" href={pageHref(persistedFilters, filters.page + 1)}>Próxima</Link>}
        </div>
      </div>
    </div>
  )
}
