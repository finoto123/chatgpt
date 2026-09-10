import { ReactNode } from 'react'

interface KpiCardProps {
  title: string
  value: string | number
  icon: ReactNode
  alert?: boolean
  progress?: number
  progressLabel?: string
  subtitle?: string
  accentColor?: string
}

export function KpiCard({ title, value, icon, alert, progress, progressLabel, subtitle, accentColor = '#22C55E' }: KpiCardProps) {
  const accent = alert ? '#F59E0B' : accentColor

  // Estilos condicionais para o estado de alerta
  const cardStyle = alert
    ? {
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.2)',
        boxShadow: 'var(--shadow-sm)',
      }
    : {
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }

  const titleColor = alert ? '#F59E0B' : 'var(--fg-muted)'
  const valueColor = alert ? '#FCD34D' : 'var(--fg)'

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 relative overflow-hidden transition-all"
      style={cardStyle}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      <div className="flex items-start justify-between">
        <p className="text-sm font-medium" style={{ color: titleColor }}>{title}</p>
        <div
          className="p-2 rounded-lg"
          style={{
            background: `${accent}18`,
            color: accent,
          }}
        >
          {icon}
        </div>
      </div>

      <p
        className="text-3xl font-semibold"
        style={{ letterSpacing: '-0.03em', lineHeight: '1', color: valueColor }}
      >
        {value}
      </p>

      {alert && (
        <p className="text-xs font-medium" style={{ color: '#b45309' }}>⚠️ Ação necessária</p>
      )}

      {subtitle && <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{subtitle}</p>}

      {progress !== undefined && (
        <div>
          <div className="w-full rounded-full h-1" style={{ background: 'var(--border-medium)' }}>
            <div
              className="h-1 rounded-full transition-all"
              style={{ width: `${Math.min(100, progress)}%`, background: accent }}
            />
          </div>
          {progressLabel && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--fg-muted)' }}>{progressLabel}</p>
          )}
        </div>
      )}
    </div>
  )
}
