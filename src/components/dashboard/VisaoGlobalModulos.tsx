import Link from 'next/link'
import { Package, Truck, DollarSign, Shirt } from 'lucide-react'
import { formatBRL } from '@/lib/utils'

interface VisaoGlobalProps {
  estamparia: {
    sublimacao: number
    dtf: number
    bordado: number
  }
  oficinas: number
  financeiro: number
}

export function VisaoGlobalModulos({ estamparia, oficinas, financeiro }: VisaoGlobalProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Link href="/sublimacao" className="block">
        <div className="bg-card border border-border hover:border-[#818CF8] transition-colors rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-950/30 text-indigo-400">
            <Shirt size={18} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Sublimação</p>
            <p className="text-lg font-bold text-foreground leading-tight">{estamparia.sublimacao}</p>
          </div>
        </div>
      </Link>

      <Link href="/dtf" className="block">
        <div className="bg-card border border-border hover:border-[#F472B6] transition-colors rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-pink-950/30 text-pink-400">
            <Package size={18} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">DTF</p>
            <p className="text-lg font-bold text-foreground leading-tight">{estamparia.dtf}</p>
          </div>
        </div>
      </Link>

      <Link href="/bordados" className="block">
        <div className="bg-card border border-border hover:border-[#34D399] transition-colors rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-950/30 text-emerald-400">
            <Shirt size={18} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Bordados</p>
            <p className="text-lg font-bold text-foreground leading-tight">{estamparia.bordado}</p>
          </div>
        </div>
      </Link>

      <Link href="/oficinas" className="block">
        <div className="bg-card border border-border hover:border-[#FBBF24] transition-colors rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-950/30 text-amber-400">
            <Truck size={18} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Oficinas (Pçs)</p>
            <p className="text-lg font-bold text-foreground leading-tight">{oficinas}</p>
          </div>
        </div>
      </Link>

      <Link href="/financeiro" className="block">
        <div className="bg-card border border-border hover:border-[#22D3EE] transition-colors rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-950/30 text-cyan-400">
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">A Receber</p>
            <p className="text-lg font-bold text-foreground leading-tight">{formatBRL(financeiro)}</p>
          </div>
        </div>
      </Link>
    </div>
  )
}
