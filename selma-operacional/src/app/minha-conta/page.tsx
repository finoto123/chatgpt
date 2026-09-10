import { requireAuthorizationContext } from '@/lib/auth/require-user'

export default async function MyAccountPage() {
  const context = await requireAuthorizationContext()

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <h1 className="text-2xl font-semibold">Minha conta</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">Dados do seu acesso ao sistema.</p>

      <div className="mt-6 rounded-xl border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">Nome</dt>
            <dd className="mt-1 text-sm">{context.profile.full_name || 'Não informado'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">E-mail</dt>
            <dd className="mt-1 text-sm">{context.profile.email || context.user.email || 'Não informado'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">Papéis</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {context.roles.length > 0 ? context.roles.map((role) => (
                <span key={role.id} className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  {role.name}
                </span>
              )) : <span className="text-sm text-[var(--fg-muted)]">Nenhum papel atribuído</span>}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
