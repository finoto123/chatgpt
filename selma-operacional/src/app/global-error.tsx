'use client'

export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'Segoe UI, Arial, sans-serif', background: '#f8fafc', color: '#17202a' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 460, padding: 32, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>O sistema encontrou um problema</h1>
            <p style={{ color: '#64748b' }}>Nenhum detalhe técnico foi exposto. Tente recarregar a aplicação.</p>
            <button onClick={unstable_retry} style={{ border: 0, borderRadius: 8, padding: '10px 16px', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
