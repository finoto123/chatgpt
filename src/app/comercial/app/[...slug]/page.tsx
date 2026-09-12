import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock3, Layers3 } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { requirePermission } from '@/lib/auth/require-user'
import { resolveCommercialRoute } from '@/lib/integration/commercial-route-map'

export default async function CommercialModulePage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const route = resolveCommercialRoute(slug)
  if (!route) notFound()

  await requirePermission(route.permission)
  if (route.destination) redirect(route.destination)

  return (
    <div>
      <Header title={route.title} />
      <main className="p-6">
        <section
          className="mx-auto max-w-3xl rounded-2xl border p-8"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
            <Layers3 size={24} aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-green-700">
            Módulo comercial unificado
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{route.title}</h2>
          <p className="mt-3 leading-7 text-[var(--fg-muted)]">{route.description}</p>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-950 dark:border-green-900 dark:bg-green-950/30 dark:text-green-100">
            {route.status === 'planned' ? <Clock3 className="mt-0.5 shrink-0" size={17} aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 shrink-0" size={17} aria-hidden="true" />}
            <p><strong>{route.phase}</strong> · Esta rota já pertence ao runtime Selma, usa o login único e não depende de outro servidor. {route.status === 'planned' ? 'A experiência funcional será concluída na fase indicada.' : 'A superfície de aplicação está disponível.'}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/crm"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Abrir central comercial <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border-color)' }}
            >
              Voltar ao dashboard
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
