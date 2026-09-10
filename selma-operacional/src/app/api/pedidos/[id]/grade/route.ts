import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/auth/require-user'

const uuidSchema = z.string().uuid()

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const permission = await checkPermission('orders.view')
  if (!permission.ok) {
    return NextResponse.json(
      { error: permission.status === 401 ? 'Não autenticado' : 'Acesso não autorizado' },
      { status: permission.status }
    )
  }

  const p = await params
  const idParsed = uuidSchema.safeParse(p.id)
  if (!idParsed.success) {
    return NextResponse.json({ error: 'ID de pedido inválido' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('itens_pedido')
    .select('tamanho, qtde')
    .eq('pedido_id', idParsed.data)

  if (error) return NextResponse.json({ error: 'Não foi possível consultar a grade' }, { status: 500 })

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Pedido não encontrado ou sem itens' }, { status: 404 })
  }

  // Agrupar por tamanho (remover .0 que vem de floats)
  const grade: Record<string, number> = {}
  let total = 0
  data.forEach(item => {
    const tam = String(item.tamanho ?? '').replace('.0', '').trim()
    if (tam) {
      grade[tam] = (grade[tam] ?? 0) + Number(item.qtde)
      total += Number(item.qtde)
    }
  })

  return NextResponse.json({ grade, total })
}
