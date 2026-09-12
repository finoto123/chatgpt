import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface AiAgentProfile {
  slug: string
  name: string
  purpose: string
  allowedTools: string[]
  enabled: boolean
  updatedAt: string
}

interface AiAgentProfileRow {
  slug: string
  name: string
  purpose: string
  allowed_tools: unknown
  enabled: boolean
  updated_at: string
}

function normalizeAllowedTools(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * Read-only compatibility query for the reference database.
 * Mutations belong to the future unified database and must not be added here.
 */
export async function getAiAgentProfiles(): Promise<AiAgentProfile[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('ai_agent_profiles')
    .select('slug,name,purpose,allowed_tools,enabled,updated_at')
    .order('name')

  if (error) throw error

  return ((data ?? []) as AiAgentProfileRow[]).map((agent) => ({
    slug: agent.slug,
    name: agent.name,
    purpose: agent.purpose,
    allowedTools: normalizeAllowedTools(agent.allowed_tools),
    enabled: agent.enabled,
    updatedAt: agent.updated_at,
  }))
}
