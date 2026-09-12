import { UserX } from 'lucide-react'
import { logout } from '@/app/login/actions'
import { getCurrentUser } from '@/lib/auth/require-user'
import { redirect } from 'next/navigation'

export default async function DisabledAccessPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border p-8 text-center shadow-sm"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <UserX size={25} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Acesso desativado</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">
          Seu acesso foi desativado. Entre em contato com o administrador.
        </p>
        <form action={logout} className="mt-6">
          <button type="submit" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Encerrar sessão
          </button>
        </form>
      </div>
    </div>
  )
}
