import { Bot } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { AiAgentsCatalog } from '@/components/crm/AiAgentsCatalog'
import { requirePermission } from '@/lib/auth/require-user'
import { getAiAgentProfiles } from '@/lib/supabase/queries/ai-agents'

export default async function AiAgentsPage() {
  await requirePermission('crm.view')
  const agents = await getAiAgentProfiles()

  return (
    <div>
      <Header title="Agentes de IA" />
      <main className="crm-shell">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-green-700 dark:text-green-400">
              Comercial e operacional no mesmo sistema
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Agentes de IA</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Consulte os agentes e as ferramentas disponíveis usando o mesmo acesso do restante da aplicação.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-xs text-muted" style={{ borderColor: 'var(--border-color)' }}>
            <Bot size={15} aria-hidden="true" />
            Ambiente de referência · somente leitura
          </div>
        </section>

        <AiAgentsCatalog agents={agents} />
      </main>
    </div>
  )
}
