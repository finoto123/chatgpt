import { Header } from '@/components/layout/Header'
import { CadastrosClient } from '@/components/cadastros/CadastrosClient'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Oficina, Vendedor, Feriado, EnvioOficina } from '@/types'
import { requirePermission } from '@/lib/auth/require-user'

async function getCadastrosData() {
  const supabase = await createServerSupabaseClient()

  const [oficinasRes, vendedoresRes, feriadosRes, enviosRes] = await Promise.all([
    supabase
      .from('oficinas')
      .select('*')
      .order('nome'),
    supabase
      .from('vendedores')
      .select('*')
      .order('nome'),
    supabase
      .from('feriados')
      .select('*')
      .order('data'),
    supabase
      .from('envios_oficina')
      .select('id, oficina_id, total_pecas, status')
      .eq('status', 'enviado'),
  ])

  return {
    oficinas: (oficinasRes.data ?? []) as Oficina[],
    vendedores: (vendedoresRes.data ?? []) as Vendedor[],
    feriados: (feriadosRes.data ?? []) as Feriado[],
    envios: (enviosRes.data ?? []) as EnvioOficina[],
  }
}

export default async function CadastrosPage() {
  await requirePermission('settings.view')
  const { oficinas, vendedores, feriados, envios } = await getCadastrosData()

  return (
    <div>
      <Header title="Cadastros" />
      <CadastrosClient
        oficinas={oficinas}
        vendedores={vendedores}
        feriados={feriados}
        envios={envios}
      />
    </div>
  )
}
