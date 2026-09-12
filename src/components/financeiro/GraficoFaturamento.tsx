'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { useTheme } from 'next-themes'
import { formatBRL } from '@/lib/utils'

interface DadosMes {
  mes: string
  faturamento: number
  // Flag injetada internamente para indicar mês futuro
  futuro?: boolean
}

interface TooltipPayload {
  value: number
  name: string
}

function CustomTooltip({
  active,
  payload,
  label,
  metaMensal,
  isDark,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  metaMensal: number
  isDark: boolean
}) {
  if (!active || !payload?.length) return null
  const valor = payload[0]?.value ?? 0
  // Acessa o campo futuro injetado nos dados
  const eFuturo = (payload[0] as { payload?: { futuro?: boolean } })?.payload?.futuro ?? false
  const pct = metaMensal > 0 ? ((valor / metaMensal) * 100).toFixed(1) : '0'

  return (
    <div
      className="rounded-lg p-3 text-sm"
      style={{
        background: isDark ? '#1F1F1F' : '#FFFFFF',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <p className="font-semibold" style={{ color: isDark ? '#F9FAFB' : '#111827' }}>{label}</p>
        {eFuturo && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'rgba(251,191,36,0.15)', color: '#b45309' }}
          >
            previsto
          </span>
        )}
      </div>
      <p style={{ color: eFuturo ? '#9ca3af' : '#16a34a' }}>
        Faturamento: {formatBRL(valor)}
      </p>
      <p className="text-xs mt-0.5" style={{ color: isDark ? '#9ca3af' : '#6B7280' }}>
        {pct}% da meta mensal
      </p>
    </div>
  )
}

export function GraficoFaturamento({
  dados,
  metaMensal,
  // mesAtual: índice 0-11 do mês corrente; barras com índice > mesAtual ficam opacas
  mesAtual = new Date().getMonth(),
}: {
  dados: DadosMes[]
  metaMensal: number
  mesAtual?: number
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'

  const axisColor = isDark ? '#9CA3AF' : '#6B7280'
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  // Injeta flag `futuro` em cada ponto para o tooltip identificar
  const dadosComMarca: DadosMes[] = dados.map((d, i) => ({
    ...d,
    futuro: i > mesAtual,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dadosComMarca} margin={{ top: 10, right: 55, bottom: 0, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: axisColor }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip metaMensal={metaMensal} isDark={isDark} />} />
        {/* Meta mensal: stroke grosso + cor amarela para destaque */}
        <ReferenceLine
          y={metaMensal}
          stroke="#FCD34D"
          strokeWidth={2}
          strokeDasharray="6 4"
          label={{
            value: 'Meta',
            position: 'insideTopRight',
            fontSize: 11,
            fontWeight: 700,
            fill: '#FCD34D',
          }}
        />
        <Bar dataKey="faturamento" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {dadosComMarca.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              // Meses futuros: barra transparente para indicar "sem dado real"
              fill={entry.futuro ? (isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.25)') : '#22C55E'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
