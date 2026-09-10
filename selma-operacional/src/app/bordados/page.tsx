import { getPedidosBordado } from '@/lib/supabase/queries/bordados'
import { BordadosKanban } from '@/components/bordados/BordadosKanban'
import { Header } from '@/components/layout/Header'
import { requirePermission } from '@/lib/auth/require-user'

export default async function BordadosPage() {
  await requirePermission('production.view')
  const pedidos = await getPedidosBordado()

  const aguardandoMatriz = pedidos.filter(p => !p.bordado_status || p.bordado_status === 'aguardando_matriz')
  const paraBordar       = pedidos.filter(p => p.bordado_status === 'para_bordar')
  const finalizado       = pedidos.filter(p => p.bordado_status === 'finalizado')

  return (
    <div>
      <Header title="Bordados" />
      
      <div className="space-y-5 p-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)' }}>Bordados</h1>
          <p className="text-sm text-gray-500 mt-1">
            Controle de produção interna e criação de matrizes de bordado
          </p>
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Aguardando Matriz', valor: aguardandoMatriz.length, cor: 'text-amber-600 dark:text-amber-400' },
            { label: 'Para Bordar',       valor: paraBordar.length,       cor: 'text-blue-600 dark:text-blue-400' },
            { label: 'Finalizado',        valor: finalizado.length,       cor: 'text-green-600 dark:text-green-400' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.cor}`}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        <BordadosKanban
          aguardandoMatriz={aguardandoMatriz}
          paraBordar={paraBordar}
          finalizado={finalizado}
        />
      </div>
    </div>
  )
}
