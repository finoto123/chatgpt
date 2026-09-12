export const LOGIN_PATH = '/login'
export const DEFAULT_AUTHENTICATED_PATH = '/dashboard'

export function sanitizeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return DEFAULT_AUTHENTICATED_PATH
  }

  try {
    const parsed = new URL(value, 'http://localhost')
    const decodedPath = decodeURIComponent(parsed.pathname)
    if (
      parsed.origin !== 'http://localhost'
      || parsed.pathname === LOGIN_PATH
      || decodedPath.startsWith('//')
      || decodedPath.includes('\\')
    ) {
      return DEFAULT_AUTHENTICATED_PATH
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return DEFAULT_AUTHENTICATED_PATH
  }
}

export function hasSupabaseAuthCookie(cookieNames: string[]) {
  return cookieNames.some((name) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name))
}
