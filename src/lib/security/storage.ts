import 'server-only'

import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-user'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractLayoutStoragePath, LAYOUT_BUCKET } from './upload'
import { reportServerError } from './errors'

export const SIGNED_LAYOUT_TTL_SECONDS = 5 * 60

export async function createSignedLayoutUrlForOrder(orderId: string) {
  const context = await requirePermission('orders.view')
  const parsedId = z.string().uuid().safeParse(orderId)
  if (!parsedId.success) return null

  const supabase = await createServerSupabaseClient()
  const { data: order, error: orderError } = await supabase
    .from('pedidos')
    .select('id, layout_pdf_url')
    .eq('id', parsedId.data)
    .single()

  if (orderError || !order?.layout_pdf_url) return null
  const path = extractLayoutStoragePath(order.layout_pdf_url)
  if (!path) return null

  const { data, error } = await supabase.storage
    .from(LAYOUT_BUCKET)
    .createSignedUrl(path, SIGNED_LAYOUT_TTL_SECONDS)

  if (error) {
    reportServerError(error, {
      action: 'file.signed_url',
      userId: context.user.id,
      entity: 'pedido',
      entityId: parsedId.data,
    })
    return null
  }
  return data.signedUrl
}
