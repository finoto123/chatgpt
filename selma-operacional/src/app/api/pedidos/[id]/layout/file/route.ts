import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPermission } from '@/lib/auth/require-user'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractLayoutStoragePath, LAYOUT_BUCKET } from '@/lib/security/upload'

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

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

  const parsedId = z.string().uuid().safeParse((await params).id)
  if (!parsedId.success) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  // A consulta com a sessão do usuário confirma que o pedido é visível pelas
  // regras de RLS antes de o servidor acessar o bucket privado.
  const supabase = await createServerSupabaseClient()
  const { data: order, error: orderError } = await supabase
    .from('pedidos')
    .select('layout_pdf_url')
    .eq('id', parsedId.data)
    .maybeSingle()

  const storagePath = extractLayoutStoragePath(order?.layout_pdf_url)
  if (orderError || !storagePath) {
    return NextResponse.json({ error: 'Layout não encontrado' }, { status: 404 })
  }

  const extension = storagePath.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME_BY_EXTENSION[extension]
  if (!contentType) return NextResponse.json({ error: 'Formato de layout inválido' }, { status: 415 })

  const admin = createAdminSupabaseClient()
  const { data: file, error: downloadError } = await admin.storage
    .from(LAYOUT_BUCKET)
    .download(storagePath)

  if (downloadError || !file) {
    return NextResponse.json({ error: 'Arquivo de layout indisponível' }, { status: 404 })
  }

  return new Response(await file.arrayBuffer(), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="layout.${extension === 'jpeg' ? 'jpg' : extension}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
