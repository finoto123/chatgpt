import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/auth/require-user'
import { createSignedLayoutUrlForOrder } from '@/lib/security/storage'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const permission = await checkPermission('orders.view')
  if (!permission.ok) {
    return NextResponse.json(
      { error: permission.status === 401 ? 'Não autenticado' : 'Acesso não autorizado' },
      { status: permission.status },
    )
  }

  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  const signedUrl = await createSignedLayoutUrlForOrder(id)
  if (!signedUrl) {
    return NextResponse.json({ error: 'Layout não encontrado' }, { status: 404 })
  }

  return NextResponse.json(
    { signedUrl, expiresIn: 300 },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
