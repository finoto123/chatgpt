import { ShoppingCart } from 'lucide-react'

interface Tecido {
  codigo: string
  descricao: string
  situacao: string
  estoque_atual: number
  unidade: string
}

export function TecidosAlerta({ tecidos }: { tecidos: Tecido[] }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart size={15} style={{ color: '#dc2626' }} />
        <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Tecidos para Comprar</h3>
        {tecidos.length > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-bold ml-auto"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}
          >
            {tecidos.length} alertas
          </span>
        )}
      </div>

      {tecidos.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--fg-muted)' }}>
          Estoque OK — nenhum item crítico
        </p>
      ) : (
        <div>
          {tecidos.map(t => (
            <div
              key={t.codigo}
              className="flex items-center justify-between py-2.5 last:border-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>{t.descricao}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                  {t.codigo} · {t.estoque_atual} {t.unidade}
                </p>
              </div>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full ml-3 flex-shrink-0"
                style={
                  t.situacao === 'COMPRAR'
                    ? { background: 'rgba(239,68,68,0.12)', color: '#dc2626' }
                    : { background: 'rgba(245,158,11,0.12)', color: '#b45309' }
                }
              >
                {t.situacao}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
