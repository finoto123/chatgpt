import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="grid min-h-full place-items-center p-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-green-600">404</p>
        <h1 className="mt-1 text-xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted">O endereço pode estar incorreto ou o registro não está disponível.</p>
        <Link href="/dashboard" className="mt-5 inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white">Voltar ao dashboard</Link>
      </div>
    </main>
  )
}
