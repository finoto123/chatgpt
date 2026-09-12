import { getClientesComEstatisticas } from '@/lib/supabase/queries/clientes'
import { Header } from '@/components/layout/Header'
import { ClientesClient } from '@/components/clientes/ClientesClient'
import { hasPermission, requirePermission } from '@/lib/auth/require-user'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  await requirePermission('customers.view')
  const canViewFinance = await hasPermission('finance.view')
  const params = await searchParams
  const clientes = await getClientesComEstatisticas()

  return (
    <div>
      <Header title="Clientes" />
      <div className="p-6">
        <ClientesClient
          clientes={canViewFinance ? clientes : clientes.map((cliente) => ({ ...cliente, valor_total: undefined }))}
          searchInicial={params.search ?? ''}
          canViewFinance={canViewFinance}
        />
      </div>
    </div>
  )
}
