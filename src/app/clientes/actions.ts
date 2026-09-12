'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/require-user'
import { safeDatabaseError } from '@/lib/security/errors'
import { z } from 'zod'

const clienteSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  contato: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  cidade: z.string().trim().max(120).optional(),
  observacoes: z.string().trim().max(2000).optional(),
}).strict()

export async function criarCliente(data: unknown): Promise<{ success?: boolean; error?: string; id?: string }> {
  await requirePermission('customers.create')
  const parsed = clienteSchema.safeParse(data)
  if (!parsed.success) return { error: 'Revise os dados do cliente.' }
  const supabase = await createServerSupabaseClient()
  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({ ...parsed.data, nome: parsed.data.nome.toLocaleUpperCase('pt-BR') })
    .select('id')
    .single()
  if (error) return { error: safeDatabaseError(error, 'Não foi possível criar o cliente.', { action: 'customer.create' }) }
  revalidatePath('/clientes')
  revalidatePath('/pedidos')
  return { success: true, id: cliente.id }
}

export async function atualizarCliente(id: string, data: unknown): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('customers.update')
  const parsed = z.object({ id: z.string().uuid(), data: clienteSchema }).strict().safeParse({ id, data })
  if (!parsed.success) return { error: 'Revise os dados do cliente.' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('clientes')
    .update({ ...parsed.data.data, nome: parsed.data.data.nome.toLocaleUpperCase('pt-BR') })
    .eq('id', parsed.data.id)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível atualizar o cliente.', { action: 'customer.update', entityId: parsed.data.id }) }
  revalidatePath('/clientes')
  revalidatePath('/pedidos')
  return { success: true }
}

export async function deletarCliente(id: string): Promise<{ success?: boolean; error?: string }> {
  await requirePermission('customers.delete')
  const parsedId = z.string().uuid().safeParse(id)
  if (!parsedId.success) return { error: 'Cliente inválido.' }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('clientes').delete().eq('id', parsedId.data)
  if (error) return { error: safeDatabaseError(error, 'Não foi possível excluir o cliente.', { action: 'customer.delete', entityId: parsedId.data }) }
  revalidatePath('/clientes')
  return { success: true }
}
