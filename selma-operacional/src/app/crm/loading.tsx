const block = 'rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]'

export default function CrmLoading() {
  return (
    <main className="crm-shell animate-pulse" aria-busy="true" aria-label="Carregando CRM">
      <div className={`h-11 max-w-2xl ${block}`} />
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-[var(--bg-muted)]" />
        <div className="h-8 w-64 rounded bg-[var(--bg-muted)]" />
        <div className="h-4 max-w-md rounded bg-[var(--bg-muted)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={`h-32 ${block}`} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={`h-20 ${block}`} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className={`h-80 ${block}`} />
        <div className={`h-80 ${block}`} />
      </div>
    </main>
  )
}
