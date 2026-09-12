import { Suspense } from 'react'
import { Target, TrendingUp, CalendarDays, DollarSign, Clock } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { KpiCard } from '@/components/shared/KpiCard'
import { GraficoFaturamento } from '@/components/financeiro/GraficoFaturamento'
import { FiltrosRecebimentos } from '@/components/financeiro/FiltrosRecebimentos'
import { TabelaRecebimentos } from '@/components/financeiro/TabelaRecebimentos'
import {
  getKpisFinanceiro,
  getFaturamentoMensal,
  getRecebimentosPorPedido,
} from '@/lib/supabase/queries/financeiro'
import { formatBRL } from '@/lib/utils'
import { requirePermission } from '@/lib/auth/require-user'

// Margem de operação abaixo deste % aciona o alerta vermelho com ⚠️
const THRESHOLD_MARGEM_PCT = 10

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; status?: string }>
}) {
  await requirePermission('finance.view')
  const { mes, status } = await searchParams
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mesAtual = hoje.getMonth() // índice 0-11 para o gráfico

  const [kpis, dadosMensais, recebimentos] = await Promise.all([
    getKpisFinanceiro(),
    getFaturamentoMensal(ano),
    getRecebimentosPorPedido(mes, status),
  ])

  const progressoAnual = kpis.metaAnual > 0 ? (kpis.totalAnual / kpis.metaAnual) * 100 : 0
  const progressoMes   = kpis.metaMensal > 0 ? (kpis.totalMes / kpis.metaMensal) * 100 : 0

  const margemNum =
    kpis.totalMes > 0
      ? ((kpis.totalMes - kpis.despesasFixasMensais) / kpis.totalMes) * 100
      : 0
  const margemOperacao = margemNum.toFixed(1)
  // Margem crítica: abaixo do threshold configurável
  const margemCritica = margemNum < THRESHOLD_MARGEM_PCT

  // Faturamento do mês zerado após dia 5 = alerta amarelo
  const faturamentoZerado = kpis.totalMes === 0 && hoje.getDate() > 5

  // Dias desde o pedido em aberto mais antigo
  const diasMaisAntigo =
    kpis.pedidosMaisAntigoPendente !== null
      ? Math.floor(
          (hoje.getTime() - new Date(kpis.pedidosMaisAntigoPendente + 'T00:00:00').getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null

  // Subtítulo do card "Total a Receber"
  const subtitleAReceber =
    kpis.pedidosAbertosCount > 0
      ? `${kpis.pedidosAbertosCount} pedido${kpis.pedidosAbertosCount > 1 ? 's' : ''} em aberto${diasMaisAntigo !== null ? ` · Mais antigo: ${diasMaisAntigo}d` : ''}`
      : 'Nenhum pedido em aberto'

  return (
    <div>
      <Header title="Financeiro" />
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-4">
          <KpiCard
            title="Meta Anual"
            value={formatBRL(kpis.metaAnual)}
            icon={<Target size={18} />}
          />
          <KpiCard
            title={`Faturamento ${ano}`}
            value={formatBRL(kpis.totalAnual)}
            icon={<TrendingUp size={18} />}
            progress={progressoAnual}
            progressLabel={`${progressoAnual.toFixed(1)}% da meta anual atingida`}
          />
          <KpiCard
            title="Meta Mensal"
            value={formatBRL(kpis.metaMensal)}
            icon={<CalendarDays size={18} />}
          />
          <KpiCard
            title="Faturamento do Mês"
            value={formatBRL(kpis.totalMes)}
            icon={<DollarSign size={18} />}
            progress={progressoMes}
            progressLabel={`${progressoMes.toFixed(1)}% da meta mensal`}
            // Alerta amarelo quando o mês já passou do dia 5 e ainda não faturou nada
            alert={faturamentoZerado}
            subtitle={faturamentoZerado ? 'Nenhum faturamento registrado este mês' : undefined}
          />
          <KpiCard
            title="Total a Receber"
            value={formatBRL(kpis.totalAReceber)}
            icon={<Clock size={18} />}
            alert={kpis.totalAReceber > 0}
            subtitle={subtitleAReceber}
          />
        </div>

        {/* Layout 2 colunas */}
        <div className="grid grid-cols-3 gap-6">
          {/* Gráfico de Faturamento — ocupa 2/3 */}
          <div
            className="col-span-2 rounded-xl p-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--fg)' }}>
              Evolução do Faturamento — {ano}
            </h2>
            <GraficoFaturamento dados={dadosMensais} metaMensal={kpis.metaMensal} mesAtual={mesAtual} />
          </div>

          {/* Despesas Fixas — ocupa 1/3 */}
          <div
            className="rounded-xl p-5 space-y-5"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Despesas Fixas</h2>

            <div className="space-y-0">
              <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>Mensal</span>
                <span className="text-base font-bold" style={{ color: 'var(--fg)' }}>
                  {formatBRL(kpis.despesasFixasMensais)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>Projeção Anual</span>
                <span className="text-base font-bold" style={{ color: 'var(--fg)' }}>
                  {formatBRL(kpis.despesasFixasMensais * 12)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>Margem de Operação</span>
                {/* Alerta vermelho com ⚠️ quando margem abaixo do threshold (padrão: 10%) */}
                <span
                  className="inline-flex items-center gap-1 text-base font-bold"
                  style={{ color: margemCritica ? '#dc2626' : '#16a34a' }}
                >
                  {margemCritica && <span aria-label="Alerta de margem baixa">⚠️</span>}
                  {margemOperacao}%
                </span>
              </div>
            </div>

            <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--fg-muted)' }}>Faturamento do Mês</p>
              <p className="text-lg font-bold" style={{ color: '#15803d' }}>{formatBRL(kpis.totalMes)}</p>
              <div className="mt-2 w-full rounded-full h-1" style={{ background: 'var(--border-medium)' }}>
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${Math.min(100, progressoMes)}%`, background: '#22C55E' }}
                />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
                Meta: {formatBRL(kpis.metaMensal)}
              </p>
            </div>
          </div>
        </div>

        {/* Tabela de Recebimentos */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="p-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Recebimentos por Pedido</h2>
              <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                {recebimentos.length} registro{recebimentos.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Suspense fallback={null}>
              <FiltrosRecebimentos />
            </Suspense>
          </div>
          {/* Tabela com sorting por coluna e paginação cliente */}
          <TabelaRecebimentos recebimentos={recebimentos} />
        </div>
      </div>
    </div>
  )
}
