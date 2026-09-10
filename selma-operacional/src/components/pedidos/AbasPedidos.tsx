'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export function AbasPedidos({
  abaAtiva,
  qtdeRascunhos,
}: {
  abaAtiva: string
  qtdeRascunhos: number
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const mudarAba = (aba: string) => {
    const params = new URLSearchParams(sp.toString())
    params.set('aba', aba)
    params.delete('status') // resetar filtro de status ao trocar aba
    params.delete('page')
    router.push(`/pedidos?${params.toString()}`, { scroll: false })
  }

  const ABAS = [
    { id: 'ativos',     label: 'Pedidos Ativos' },
    { id: 'rascunhos',  label: `Rascunhos${qtdeRascunhos > 0 ? ` (${qtdeRascunhos})` : ''}` },
    { id: 'cancelados', label: 'Cancelados' },
  ]

  return (
    <div className="flex gap-1 border-b mb-5" style={{ borderColor: 'var(--border-color)' }}>
      {ABAS.map(aba => (
        <button
          key={aba.id}
          onClick={() => mudarAba(aba.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
            abaAtiva === aba.id
              ? 'border-green-600 dark:border-green-500 text-green-700 dark:text-green-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          {aba.label}
        </button>
      ))}
    </div>
  )
}
