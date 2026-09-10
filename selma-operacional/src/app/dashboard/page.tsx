import { ClipboardList, Package, AlertTriangle } from 'lucide-react'
import { 
  getDashboardKpis, 
  getPipelineKanban, 
  getPedidosEntregaProxima, 
  getTecidosParaComprar,
  getOficinas
} from '@/lib/supabase/queries/dashboard'
import { KpiCard } from '@/components/shared/KpiCard'
import { PipelineKanban } from '@/components/dashboard/PipelineKanban'
import { EntregaProxima } from '@/components/dashboard/EntregaProxima'
import { TecidosAlerta } from '@/components/dashboard/TecidosAlerta'
import { Header } from '@/components/layout/Header'
import { requirePermission } from '@/lib/auth/require-user'
import { getQuoteDashboardStats } from '@/lib/supabase/queries/quotes'

export default async function DashboardPage() {
  await requirePermission('dashboard.view')
  const [kpis, pipeline, entregaProxima, tecidosComprar, oficinas, quotes] = await Promise.all([
    getDashboardKpis(),
    getPipelineKanban(),
    getPedidosEntregaProxima(),
    getTecidosParaComprar(),
    getOficinas(),
    getQuoteDashboardStats(),
  ])

  return (
    <div>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            title="Total Pedidos Ativos"
            value={kpis.totalPedidosAtivos}
            icon={<ClipboardList size={18} />}
            accentColor="#22C55E"
          />
          <KpiCard
            title="Peças em Produção"
            value={kpis.totalPecasProducao}
            icon={<Package size={18} />}
            accentColor="#22D3EE"
          />
          <KpiCard
            title="Peças em Atraso"
            value={kpis.totalPecasAtraso}
            icon={<AlertTriangle size={18} />}
            alert={kpis.totalPecasAtraso > 0}
          />

        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard title="Orçamentos criados" value={quotes.created} icon={<ClipboardList size={18}/>} accentColor="#16A34A" />
          <KpiCard title="Propostas enviadas" value={quotes.sent} subtitle={`${quotes.sentValue.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} enviados`} icon={<ClipboardList size={18}/>} accentColor="#2563EB" />
          <KpiCard title="Aguardando retorno" value={quotes.waiting} icon={<AlertTriangle size={18}/>} accentColor="#F59E0B" />
          <KpiCard title="Taxa de aprovação" value={`${quotes.approvalRate}%`} subtitle={`${quotes.approvedValue.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · margem ${quotes.averageMargin}%`} icon={<Package size={18}/>} accentColor="#7C3AED" />
          <KpiCard title="Em aprovação comercial" value={quotes.pendingApprovalValue.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} subtitle={`${quotes.pendingApprovals} pendente${quotes.pendingApprovals===1?'':'s'}`} icon={<AlertTriangle size={18}/>} accentColor="#DC2626" />
        </div>

        <PipelineKanban pedidos={pipeline as never} oficinas={oficinas} />

        <div className="grid grid-cols-2 gap-4">
          <EntregaProxima pedidos={entregaProxima as never} />
          <TecidosAlerta tecidos={tecidosComprar as never} />
        </div>
      </div>
    </div>
  )
}
