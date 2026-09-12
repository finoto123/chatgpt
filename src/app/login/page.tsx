import { ShieldCheck } from 'lucide-react'
import { LoginForm } from './LoginForm'

const notices: Record<string, string> = {
  session_expired: 'Sua sessão expirou. Entre novamente para continuar.',
  signed_out: 'Sessão encerrada com segurança.',
  configuration: 'A autenticação ainda não foi configurada neste ambiente.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>
}) {
  const params = await searchParams
  const notice = params.reason ? notices[params.reason] : undefined

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl border p-7 shadow-lg sm:p-9"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <ShieldCheck size={25} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Acessar o sistema</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--fg-muted)]">
            Entre com o usuário interno cadastrado no Supabase Auth.
          </p>
          {notice && (
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {notice}
            </p>
          )}
          <LoginForm nextPath={params.next} />
        </div>
        <p className="mt-5 text-center text-xs text-[var(--fg-muted)]">
          Selma Bordados · Gestão Comercial e Operacional
        </p>
      </div>
    </div>
  )
}
