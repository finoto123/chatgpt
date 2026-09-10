'use client'

import { StatusPedido } from '@/types'

const STATUS_DETAILS: Record<StatusPedido, { label: string; badgeClass: string; dotClass: string }> = {
  rascunho: {
    label: 'Rascunho',
    badgeClass: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800/30',
    dotClass: 'bg-gray-500 dark:bg-gray-600',
  },
  aguardando_corte: {
    label: 'Ag. Corte',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30',
    dotClass: 'bg-indigo-600 dark:bg-indigo-500',
  },
  corte: {
    label: 'Em Corte',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/30',
    dotClass: 'bg-cyan-600 dark:bg-cyan-500',
  },
  estamparia: {
    label: 'Estamparia',
    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/30',
    dotClass: 'bg-violet-600 dark:bg-violet-500',
  },
  sublimacao: {
    label: 'Estampa',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/30',
    dotClass: 'bg-purple-600 dark:bg-purple-500',
  },
  dtf: {
    label: 'DTF',
    badgeClass: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800/30',
    dotClass: 'bg-pink-600 dark:bg-pink-500',
  },
  bordados: {
    label: 'Bordados',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30',
    dotClass: 'bg-emerald-600 dark:bg-emerald-500',
  },
  costura: {
    label: 'Costura',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',
    dotClass: 'bg-amber-600 dark:bg-amber-500',
  },
  acabamento: {
    label: 'Acabamento',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800/30',
    dotClass: 'bg-teal-600 dark:bg-teal-500',
  },
  entregue: {
    label: 'Entregue',
    badgeClass: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30',
    dotClass: 'bg-green-600 dark:bg-green-500',
  },
  atrasado: {
    label: 'Atrasado',
    badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',
    dotClass: 'bg-red-600 dark:bg-red-500',
  },
  cancelado: {
    label: 'Cancelado',
    badgeClass: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800/30',
    dotClass: 'bg-gray-500 dark:bg-gray-600',
  },
}

export function StatusBadge({ status }: { status: StatusPedido | string }) {
  const details = STATUS_DETAILS[status as StatusPedido] || {
    label: (status || 'Desconhecido').toUpperCase(),
    badgeClass: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800/30',
    dotClass: 'bg-gray-500 dark:bg-gray-600',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${details.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${details.dotClass}`} />
      {details.label}
    </span>
  )
}
