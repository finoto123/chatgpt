import 'server-only'

import { headers } from 'next/headers'

interface RateLimitOptions {
  scope: string
  identifier?: string
  limit: number
  windowSeconds: number
}

export type RateLimitResult =
  | { allowed: true; enforced: boolean }
  | { allowed: false; enforced: true; retryAfterSeconds: number }

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { allowed: true, enforced: false }

  const requestHeaders = await headers()
  const forwarded = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
  const identity = options.identifier?.trim().toLowerCase() || forwarded || 'unknown'
  const identityDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  const identityHash = Array.from(new Uint8Array(identityDigest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const bucket = Math.floor(Date.now() / (options.windowSeconds * 1000))
  const key = `rate:${options.scope}:${identityHash}:${bucket}`
  const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"

  try {
    const endpoint = url.replace(/\/+$/, '')
    const response = await fetch(`${endpoint}/eval/${encodeURIComponent(script)}/1/${encodeURIComponent(key)}/${options.windowSeconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Rate limit distribuído indisponível.')
    const payload = await response.json() as { result?: number }
    const count = Number(payload.result ?? options.limit + 1)
    return count > options.limit
      ? { allowed: false, enforced: true, retryAfterSeconds: options.windowSeconds }
      : { allowed: true, enforced: true }
  } catch {
    // Fail closed quando o limitador foi configurado mas está indisponível.
    return { allowed: false, enforced: true, retryAfterSeconds: options.windowSeconds }
  }
}
