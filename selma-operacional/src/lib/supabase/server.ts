import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicConfig } from './env'

export type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const { url, publishableKey } = getSupabasePublicConfig()

  return createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )
}
