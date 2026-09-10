'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('Falha ao renderizar página', { digest: error.digest })
  }, [error])

  return (
    <main className="grid min-h-full place-items-center p-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Não foi possível carregar esta página</h1>
        <p className="mt-2 text-sm text-muted">Tente novamente. Se o problema continuar, contate o administrador.</p>
        <Button className="mt-5" onClick={unstable_retry}>Tentar novamente</Button>
      </div>
    </main>
  )
}
