import { Package, DollarSign, ShoppingCart, AlertTriangle } from 'lucide-react'
import { getEstoqueAtual, getKpisEstoque } from '@/lib/supabase/queries/estoque'
import { Header } from '@/components/layout/Header'
import { KpiCard } from '@/components/shared/KpiCard'
import { EstoqueTable } from '@/components/estoque/EstoqueTable'
import { formatBRL } from '@/lib/utils'
import { requirePermission } from '@/lib/auth/require-user'

export default async function EstoquePage() {
  await requirePermission('inventory.view')
  const [kpis, itens] = await Promise.all([
    getKpisEstoque(),
    getEstoqueAtual(),
  ])

  return (
    <div>
      <Header title="Estoque de Tecidos" />
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            title="Total de Itens"
            value={kpis.totalItens}
            icon={<Package size={18} />}
          />
          <KpiCard
            title="Valor Total do Estoque"
            value={formatBRL(kpis.valorTotal)}
            icon={<DollarSign size={18} />}
          />
          <KpiCard
            title="Itens para Comprar"
            value={kpis.paraComprar}
            icon={<ShoppingCart size={18} />}
            alert={kpis.paraComprar > 0}
          />
          <KpiCard
            title="Itens em Atenção"
            value={kpis.emAtencao}
            icon={<AlertTriangle size={18} />}
            alert={kpis.emAtencao > 0}
          />
        </div>

        {/* Tabela com busca e movimentação integradas */}
        <EstoqueTable itens={itens} />
      </div>
    </div>
  )
}
