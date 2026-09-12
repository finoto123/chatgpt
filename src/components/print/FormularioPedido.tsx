'use client'

import { Pedido } from '@/types'
import { formatDate, formatTamanho, parseModeloParts, labelEtapaEstampa } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'

// pdfjs-dist referencia DOMMatrix (API só de browser) na avaliação do módulo,
// o que derruba o SSR da página de impressão mesmo com 'use client'. Carrega
// só no cliente.
const PdfLayoutCanvas = dynamic(
  () => import('./PdfLayoutCanvas').then(mod => mod.PdfLayoutCanvas),
  { ssr: false }
)

function normalizeTexto(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function formatTiposEstampaParaImpressao(tipoEstampa: string | null | undefined) {
  const tipos = (tipoEstampa ?? '')
    .split(',')
    .map(tipo => tipo.trim())
    .filter(Boolean)
    .filter(tipo => normalizeTexto(tipo) !== 'DTF')

  return tipos.join(', ')
}

export function FormularioPedido({ pedido, canViewFinance }: { pedido: Pedido; canViewFinance: boolean }) {
  const router = useRouter()
  const [layoutReady, setLayoutReady] = useState(!pedido.layout_pdf_url)
  const markLayoutReady = useCallback(() => setLayoutReady(true), [])
  // Suporte tanto ao campo itens (mapeado) quanto itens_pedido (direto do Supabase)
  const itens = pedido.itens ?? (pedido as unknown as { itens_pedido?: Pedido['itens'] }).itens_pedido ?? []
  const total = itens.reduce((s, i) => s + i.qtde * i.valor_unitario, 0)
  const qtdeTotal = itens.reduce((s, i) => s + i.qtde, 0)
  const restoPagar = Math.max(0, total - (pedido.valor_entrada ?? 0))
  // Sem linhas vazias de preenchimento: mostra só os itens do pedido.
  const linhasVazias = 0
  const layoutReference = pedido.layout_pdf_url
  const layoutUrl = layoutReference ? `/api/pedidos/${pedido.id}/layout/file` : null
  const layoutPath = layoutReference?.split('?')[0].toLowerCase() ?? ''
  const layoutIsImage = /\.(png|jpe?g|webp|gif)$/i.test(layoutPath)
  const layoutIsPdf = /\.pdf$/i.test(layoutPath)
  const tiposEstampaPrint = formatTiposEstampaParaImpressao(pedido.tipo_estampa)
  const estampaOficinaPrint = pedido.estampa_oficina?.nome ? `(${pedido.estampa_oficina.nome})` : ''

  const renderBRL = (value: number) => {
    const num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
        <span>R$</span>
        <span>{num}</span>
      </div>
    )
  }

  return (
    <>
      <style>{`
        #formulario-a4 {
          font-family: Arial, Helvetica, sans-serif !important;
          color: #000 !important;
          background-color: #fff !important;
          width: 210mm;
          margin: 0 auto;
          padding: 10mm;
        }
        #formulario-a4 * {
          box-sizing: border-box;
        }
        .form-table {
          width: 100%;
          border-collapse: collapse;
          border: 2px solid #000;
          table-layout: fixed;
        }
        .form-table td, .form-table th {
          border: 1px solid #000;
          padding: 2px 4px;
          font-size: 11px;
          height: 24px;
          vertical-align: middle;
        }
        .form-table .bold { font-weight: bold; }
        .form-table .center { text-align: center; }
        .form-table .right { text-align: right; }
        .form-table .uppercase { text-transform: uppercase; }

        .bg-grey { background-color: #e7e6e6 !important; }
        .bg-light-blue { background-color: #d9e1f2 !important; }
        .bg-yellow { background-color: #ffff00 !important; }
        .bg-orange { background-color: #fcd5b4 !important; }
        .bg-peach { background-color: #fce4d6 !important; }

        .text-red { color: #cc0000 !important; }
        
        /* Print overrides */
        @media print {
          body { background: #fff; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 5mm; }
          #formulario-a4 { margin: 0; padding: 5mm; width: 100%; }
          
          /* Ensure background colors print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="no-print bg-gray-100 p-4 flex gap-3 sticky top-0 z-10 border-b">
        <button onClick={() => router.back()} className="px-4 py-2 border border-gray-300 rounded text-sm text-black hover:bg-gray-200">
          ← Voltar
        </button>
        <button disabled={!layoutReady} onClick={() => window.print()} className="px-4 py-2 bg-[#1e7e3e] disabled:bg-gray-400 text-white rounded text-sm font-medium hover:bg-[#2d9b54] disabled:cursor-wait">
          {layoutReady ? '🖨️ Imprimir Agora' : 'Carregando layout...'}
        </button>
      </div>

      <div id="formulario-a4">
        {/* Table 1: Header */}
        <table className="form-table" style={{ borderBottom: 'none' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '60%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td className="center" style={{ padding: '4px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-selma.png"
                  alt="Selma Bordados e Confecções"
                  style={{ maxWidth: '100%', maxHeight: '70px', objectFit: 'contain', margin: '0 auto' }}
                />
              </td>
              <td className="center bold" style={{ fontSize: '20px', letterSpacing: '1px' }}>
                PEDIDO CLIENTE
              </td>
              <td className="center bold text-red" style={{ fontSize: '14px' }}>
                {pedido.numero}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Table 2: Details */}
        <table className="form-table" style={{ borderTop: 'none', borderBottom: 'none' }}>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '35%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '12.5%' }} />
            <col style={{ width: '12.5%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td className="bg-grey bold">CLIENTE</td>
              <td colSpan={3} className="center uppercase">{pedido.cliente}</td>
              <td className="center">Data pedido</td>
              <td className="center text-red bold">{formatDate(pedido.data_pedido)}</td>
            </tr>
            {(pedido.vendedor?.nome || pedido.corte_programado || pedido.corte_retorno) && (
              <tr>
                <td className="bg-light-blue bold">VENDEDOR</td>
                <td className="center uppercase">{pedido.vendedor?.nome}</td>
                <td className="center bold">CORTE</td>
                <td className="center">{formatDate(pedido.corte_programado)}</td>
                <td className="center text-red bold">RETORNO</td>
                <td className="center">{formatDate(pedido.corte_retorno)}</td>
              </tr>
            )}
            {(pedido.tipo_estampa || pedido.estamparia_programado || pedido.estamparia_retorno) && (
              <tr>
                <td className="bg-grey bold">ESTAMPA</td>
                <td className="center uppercase">
                  {[tiposEstampaPrint, estampaOficinaPrint].filter(Boolean).join(' ')}
                </td>
                <td className="center bold">{labelEtapaEstampa(pedido.tipo_estampa)}</td>
                <td className="center">{formatDate(pedido.estamparia_programado)}</td>
                <td className="center text-red bold">RETORNO</td>
                <td className="center">{formatDate(pedido.estamparia_retorno)}</td>
              </tr>
            )}
            {(pedido.sublimacao_programado || pedido.sublimacao_retorno) && (
              <tr>
                <td colSpan={2}></td>
                <td className="center bold" style={{ backgroundColor: 'rgba(124,58,237,0.1)' }}>SUBLIMAÇÃO</td>
                <td className="center">{formatDate(pedido.sublimacao_programado)}</td>
                <td className="center text-red bold">RETORNO</td>
                <td className="center">{formatDate(pedido.sublimacao_retorno)}</td>
              </tr>
            )}
            {(pedido.costureira?.nome || pedido.costura_programado || pedido.costura_retorno) && (
              <tr>
                <td className="bg-light-blue bold">COSTUREIRA</td>
                <td className="center uppercase">{pedido.costureira?.nome}</td>
                <td className="center bold">COSTURA</td>
                <td className="center">{formatDate(pedido.costura_programado)}</td>
                <td className="center text-red bold">RETORNO</td>
                <td className="center">{formatDate(pedido.costura_retorno)}</td>
              </tr>
            )}
            <tr>
              <td className="center text-red bold">Forma /PG</td>
              <td className="center uppercase">{canViewFinance ? pedido.forma_pagamento : 'RESTRITO'}</td>
              <td className="bg-yellow center bold">ENTREGA</td>
              <td className="bg-yellow center bold text-red">{formatDate(pedido.entrega_programado)}</td>
              <td className="bg-yellow center bold">TECIDO</td>
              <td className="bg-yellow center uppercase">{pedido.fornecedor_tecido}</td>
            </tr>
          </tbody>
        </table>

        {/* Table 3: Items */}
        <table className="form-table" style={{ borderTop: 'none', borderBottom: 'none' }}>
          <colgroup>
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr className="bg-orange center bold">
              <td>Qtde</td>
              <td>Tam</td>
              <td>MODELO</td>
              <td>Tecido/cor</td>
              <td>Manga</td>
              <td>Gola</td>
              <td>Acabamento</td>
              <td>Valor unit.</td>
              <td>Valor Total</td>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, i) => {
              const parsed = parseModeloParts({
                modelo: item.modelo,
                manga: item.manga,
                gola: item.gola,
                acabamento: item.acabamento
              })
              return (
                <tr key={item.id ?? i} className="center uppercase">
                  <td>{item.qtde}</td>
                  <td>{formatTamanho(item.tamanho)}</td>
                  <td>{parsed.modelo || '—'}</td>
                  <td>{item.tecido_cor}</td>
                  <td>{parsed.manga || '—'}</td>
                  <td>{parsed.gola || '—'}</td>
                  <td>{parsed.acabamento || '—'}</td>
                  <td>{canViewFinance ? renderBRL(item.valor_unitario) : '—'}</td>
                  <td>{canViewFinance ? renderBRL(item.qtde * item.valor_unitario) : '—'}</td>
                </tr>
              )
            })}
            {Array.from({ length: linhasVazias }).map((_, i) => (
              <tr key={`vazio-${i}`}>
                <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
              </tr>
            ))}
            
            {/* Totals Row 1 */}
            <tr>
              <td colSpan={3} className="center">Quantidade Total</td>
              <td className="center text-red bold">{qtdeTotal}</td>
              <td colSpan={2}></td>
              <td className="center">Valor total</td>
              <td className="text-red bold">{canViewFinance ? renderBRL(total) : '—'}</td>
              <td></td>
            </tr>
            
            {/* Totals Row 2 */}
            <tr>
              <td colSpan={2} className="bg-peach center">Matriz</td>
              <td></td>
              <td className="bg-peach center bold">ENTRADA</td>
              <td colSpan={2} className="bg-peach bold">{canViewFinance ? renderBRL(pedido.valor_entrada ?? 0) : '—'}</td>
              <td className="bg-yellow center">Resto a Pagar</td>
              <td className="bg-yellow bold">{canViewFinance ? renderBRL(restoPagar) : '—'}</td>
              <td className="center bold uppercase">{canViewFinance ? pedido.forma_pagamento : 'RESTRITO'}</td>
            </tr>
          </tbody>
        </table>

        {/* Table 4: Footer */}
        {(pedido.observacoes || layoutUrl) && (
          <table className="form-table" style={{ borderTop: 'none', height: '120px' }}>
            <colgroup>
              <col style={{ width: '65%' }} />
              <col style={{ width: '35%' }} />
            </colgroup>
            <tbody>
              <tr>
                <td style={{ position: 'relative', verticalAlign: 'top' }}>
                  <div style={{ position: 'absolute', top: '10px', left: '10px' }}>Obs.</div>
                  <div className="center uppercase" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', padding: '0 40px' }}>
                    {pedido.observacoes ?? ''}
                  </div>
                </td>
                <td style={{ position: 'relative', verticalAlign: 'top' }}>
                  <div style={{ position: 'absolute', top: '10px', left: '10px' }}>Layout</div>
                  <div className="center" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 6px 4px' }}>
                    {layoutUrl && layoutIsImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={layoutUrl}
                        alt="Layout do pedido"
                        onLoad={markLayoutReady}
                        onError={markLayoutReady}
                        style={{ maxWidth: '100%', maxHeight: '95px', objectFit: 'contain' }}
                      />
                    )}
                    {layoutUrl && layoutIsPdf && (
                      <PdfLayoutCanvas url={layoutUrl} onReady={markLayoutReady} />
                    )}
                    {layoutUrl && !layoutIsImage && !layoutIsPdf && (
                      <a href={layoutUrl} target="_blank" rel="noreferrer">Abrir layout</a>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
