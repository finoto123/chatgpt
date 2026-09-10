import 'server-only'

import { headers } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { reportServerError } from '@/lib/security/errors'

const SENSITIVE_KEY = /password|senha|token|secret|service.?role|cookie|authorization|api.?key/i

export interface CreateAuditLogInput {
  userId: string
  action: string
  entityType: string
  entityId?: string | null
  oldValues?: unknown
  newValues?: unknown
  metadata?: Record<string, unknown>
  includeRequestContext?: boolean
}

export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[limite de profundidade]'
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditValue(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) =>
      SENSITIVE_KEY.test(key) ? [] : [[key, sanitizeAuditValue(item, depth + 1)]]))
  }
  return value
}

async function getRequestContext() {
  const requestHeaders = await headers()
  const forwarded = requestHeaders.get('x-forwarded-for')
  const ipAddress = forwarded?.split(',')[0]?.trim()
    || requestHeaders.get('x-real-ip')
    || null
  return {
    ipAddress,
    userAgent: requestHeaders.get('user-agent'),
  }
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const request = input.includeRequestContext === false
    ? { ipAddress: null, userAgent: null }
    : await getRequestContext()

  const { data, error } = await supabase.rpc('record_audit_event', {
    _action: input.action,
    _entity_type: input.entityType,
    _entity_id: input.entityId ?? null,
    _old_values: sanitizeAuditValue(input.oldValues) ?? null,
    _new_values: sanitizeAuditValue(input.newValues) ?? null,
    _metadata: sanitizeAuditValue(input.metadata ?? {}),
    _ip_address: request.ipAddress,
    _user_agent: request.userAgent,
  })

  if (error || !data) {
    reportServerError(error ?? new Error('RPC de auditoria não retornou ID'), {
      action: 'audit.write',
      userId: input.userId,
      entity: input.entityType,
      entityId: input.entityId ?? undefined,
    })
    const fallbackId = await writeAuthenticationAuditFallback(input, request)
    if (fallbackId) return fallbackId
    throw new Error('Não foi possível registrar a auditoria.')
  }

  return String(data)
}

async function writeAuthenticationAuditFallback(
  input: CreateAuditLogInput,
  request: { ipAddress: string | null; userAgent: string | null },
) {
  if (!['auth.login', 'auth.logout'].includes(input.action)
      || input.entityType !== 'user'
      || input.entityId !== input.userId
      || input.oldValues != null
      || input.newValues != null) return null

  try {
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin.from('audit_logs').insert({
      user_id: input.userId,
      action: input.action,
      entity_type: 'user',
      entity_id: input.userId,
      old_values: null,
      new_values: null,
      metadata: { ...(sanitizeAuditValue(input.metadata ?? {}) as Record<string, unknown>), source: 'application_admin_fallback' },
      ip_address: request.ipAddress,
      user_agent: request.userAgent,
    }).select('id').single()
    if (error || !data?.id) throw error ?? new Error('Fallback de auditoria não retornou ID')
    return String(data.id)
  } catch (fallbackError) {
    reportServerError(fallbackError, {
      action: 'audit.write.fallback',
      userId: input.userId,
      entity: input.entityType,
      entityId: input.entityId ?? undefined,
    })
    return null
  }
}
