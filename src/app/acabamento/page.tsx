import { getPedidosAcabamento } from '@/lib/supabase/queries/acabamento'
import { AcabamentoKanban } from '@/components/acabamento/AcabamentoKanban'
import { requirePermission } from '@/lib/auth/require-user'

export default async function AcabamentoPage() {
  await requirePermission('production.view')
  const pedidos = await getPedidosAcabamento()

  const aguardando  = pedidos.filter(p => !p.embalagem_status || p.embalagem_status === 'aguardando')
  const finalizando = pedidos.filter(p => p.embalagem_status === 'finalizando')
  const entregue    = pedidos.filter(p => p.embalagem_status === 'entregue' || p.status === 'entregue')

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)' }}>Acabamento</h1>
        <p className="text-sm text-gray-500 mt-1">
          Controle de embalagem, nota fiscal e entrega ao cliente
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Aguardando',  valor: aguardando.length,  cor: 'text-amber-600 dark:text-amber-400' },
          { label: 'Finalizando', valor: finalizando.length, cor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Entregues',   valor: entregue.length,    cor: 'text-green-600 dark:text-green-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.cor}`}>{kpi.valor}</p>
          </div>
        ))}
      </div>

      <AcabamentoKanban
        aguardando={aguardando}
        finalizando={finalizando}
        entregue={entregue}
      />
    </div>
  )
}
