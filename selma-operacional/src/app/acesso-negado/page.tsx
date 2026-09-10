import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { requireAuthorizationContext } from '@/lib/auth/require-user'

export default async function AccessDeniedPage() {
  await requireAuthorizationContext()

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border p-8 text-center shadow-sm"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700">
          <ShieldX size={25} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Acesso não autorizado</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">
          Você não possui permissão para acessar este recurso. Se precisar desse acesso,
          entre em contato com um administrador.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
