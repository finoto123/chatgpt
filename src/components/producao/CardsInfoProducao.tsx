import { getInfoCardsProducao } from '@/lib/supabase/queries/producao'
import { formatDate } from '@/lib/utils'

export async function CardsInfoProducao() {
  const { tecidoCritico, proximaColeta } = await getInfoCardsProducao()

  const proximaColetaTyped = proximaColeta as {
    oficina?: { nome: string } | null
    retorno_previsto?: string
    total_pecas?: number
  } | null

  return (
    <div className="grid grid-cols-3 gap-4 mt-6">
      {/* Card 1: Eficiência da Linha */}
      <div
        className="rounded-xl p-4"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📈</span>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Eficiência da Linha</h3>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: 'var(--fg-secondary)' }}>Meta diária (800 peças)</span>
          <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>85%</span>
        </div>
        <div className="w-full rounded-full h-2" style={{ background: 'var(--border-subtle)' }}>
          <div
            className="h-2 rounded-full"
            style={{ width: '85%', background: '#22C55E' }}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--fg-muted)' }}>Dados operacionais estimados</p>
      </div>

      {/* Card 2: Aviso de Reposição */}
      <div
        className="rounded-xl p-4"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">⚠️</span>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Aviso de Reposição</h3>
        </div>
        {tecidoCritico ? (
          <div className="flex items-start gap-2">
            <div
              className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
              style={{ background: '#dc2626' }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: '#dc2626' }}>
                {tecidoCritico.descricao}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--fg-secondary)' }}>
                Estoque crítico — {tecidoCritico.estoque_atual} restante(s)
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#16a34a' }}>
            ✓ Sem críticos no momento
          </p>
        )}
      </div>

      {/* Card 3: Próxima Coleta */}
      <div
        className="rounded-xl p-4"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🚚</span>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Próxima Coleta</h3>
        </div>
        {proximaColetaTyped ? (
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
              {proximaColetaTyped.oficina?.nome ?? 'Oficina'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--fg-secondary)' }}>
              Retorno previsto:{' '}
              <span className="font-medium" style={{ color: '#16a34a' }}>
                {formatDate(proximaColetaTyped.retorno_previsto)}
              </span>
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
              {proximaColetaTyped.total_pecas ?? 0} peças para retornar
            </p>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            Nenhuma coleta agendada
          </p>
        )}
      </div>
    </div>
  )
}
