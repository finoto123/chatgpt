import { getPedidosSublimacao } from '@/lib/supabase/queries/sublimacao'
import { SublimacaoKanban } from '@/components/sublimacao/SublimacaoKanban'
import { requirePermission } from '@/lib/auth/require-user'

export default async function SublimacaoPage() {
  await requirePermission('production.view')
  const pedidos = await getPedidosSublimacao()

  const aguardandoPapel = pedidos.filter(p => !p.sublimacao_status || p.sublimacao_status === 'aguardando_papel')
  const paraEstampar = pedidos.filter(p => p.sublimacao_status === 'para_estampar')
  const finalizada = pedidos.filter(p => p.sublimacao_status === 'finalizada')

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--fg)' }}>Estampa</h1>
        <p className="text-sm text-gray-500 mt-1">
          Controle de sublimacao, silk, transfer e outras estampas
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Aguardando Material', valor: aguardandoPapel.length, cor: 'text-amber-600 dark:text-amber-400' },
          { label: 'Para Estampar', valor: paraEstampar.length, cor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Finalizada', valor: finalizada.length, cor: 'text-green-600 dark:text-green-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.cor}`}>{kpi.valor}</p>
          </div>
        ))}
      </div>

      <SublimacaoKanban
        aguardandoPapel={aguardandoPapel}
        paraEstampar={paraEstampar}
        finalizada={finalizada}
      />
    </div>
  )
}
