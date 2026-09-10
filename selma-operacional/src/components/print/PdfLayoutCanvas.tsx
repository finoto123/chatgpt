'use client'

import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Worker empacotado pelo bundler (Turbopack/webpack 5) via import.meta.url.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

/**
 * Renderiza a 1ª página do PDF de layout em um <canvas>.
 * Iframe de PDF (cross-origin do Supabase Storage) não é pintado na
 * impressão; o canvas rasterizado imprime como imagem normalmente.
 */
export function PdfLayoutCanvas({ url, onReady }: { url: string; onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let cancelado = false
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null
    ;(async () => {
      try {
        // Este componente usa somente a API de renderização. Não instancia o
        // viewer nem consulta/executa JavaScript actions do documento.
        loadingTask = pdfjsLib.getDocument({
          url,
          useWasm: false,
          enableXfa: false,
          stopAtErrors: true,
        })
        const pdf = await loadingTask.promise
        const page = await pdf.getPage(1)
        const [documentActions, pageActions] = await Promise.all([
          pdf.getJSActions(),
          page.getJSActions(),
        ])
        if (
          (documentActions && Object.keys(documentActions).length > 0)
          || (pageActions && Object.keys(pageActions).length > 0)
        ) {
          throw new Error('PDF com conteúdo ativo não permitido')
        }
        const viewport = page.getViewport({ scale: 2 })
        const canvas = canvasRef.current
        if (!canvas || cancelado) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        if (!cancelado) onReady?.()
      } catch {
        if (!cancelado) {
          setErro(true)
          onReady?.()
        }
      }
    })()
    return () => {
      cancelado = true
      void loadingTask?.destroy()
    }
  }, [url, onReady])

  if (erro) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        Abrir layout
      </a>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ maxWidth: '100%', maxHeight: '95px', objectFit: 'contain' }}
    />
  )
}
