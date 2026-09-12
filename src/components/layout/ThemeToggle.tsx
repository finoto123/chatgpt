'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useSyncExternalStore } from 'react'

const subscribe = () => () => undefined

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)

  if (!mounted) return <div className="w-7 h-7" />

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        color: 'var(--fg-muted)',
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
