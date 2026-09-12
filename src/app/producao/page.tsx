import { getFilaCorte } from '@/lib/supabase/queries/producao'
import { Header } from '@/components/layout/Header'
import { FilaCorteTable } from '@/components/producao/FilaCorteTable'
import { requirePermission } from '@/lib/auth/require-user'
import { getProductionPlanningDashboard } from '@/lib/supabase/queries/operations'
import { ProductionPlanningDashboard } from '@/components/operations/ProductionPlanningDashboard'

export default async function ProducaoPage() {
  await requirePermission('production.view')
  const [pedidosRaw,planning] = await Promise.all([getFilaCorte(),getProductionPlanningDashboard()])

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Processar a situação dinâmica
  const pedidos = pedidosRaw.map(p => {
    if (p.corte_situacao === 'FINALIZADO') {
      return p
    }

    const dataPrevisaoStr = p.corte_fim_previsto || p.entrega_programado
    let isAtrasado = false
    if (dataPrevisaoStr) {
      const previsao = new Date(dataPrevisaoStr + 'T00:00:00')
      isAtrasado = previsao < hoje
    }

    if (isAtrasado) {
      return { ...p, corte_situacao: 'ATRASADO' }
    }

    if (!p.corte_situacao || p.corte_situacao === 'PENDENTE') {
      return { ...p, corte_situacao: 'AGUARDANDO CORTE' }
    }

    return p
  })

  // Os contadores (total/em andamento/em atraso) e o filtro que esconde
  // finalizados por padrão são calculados dentro de FilaCorteTable.

  return (
    <div>
      <Header title="Planejamento e Produção" />
      <div className="p-6 space-y-6">
        <ProductionPlanningDashboard data={planning} />
        <FilaCorteTable pedidos={pedidos as never} />
      </div>
    </div>
  )
}
