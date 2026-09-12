import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicConfig } from './env'
import {
  DEFAULT_AUTHENTICATED_PATH,
  LOGIN_PATH,
  hasSupabaseAuthCookie,
} from '@/lib/auth/session'

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = source.headers.get(header)
    if (value) target.headers.set(header, value)
  }
  return target
}

function redirectToLogin(request: NextRequest, response: NextResponse, reason?: string) {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = LOGIN_PATH
  loginUrl.search = ''
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  if (reason) loginUrl.searchParams.set('reason', reason)

  return copyResponseCookies(response, NextResponse.redirect(loginUrl))
}

function unauthorizedApiResponse(response: NextResponse) {
  const unauthorized = NextResponse.json(
    { error: 'Não autenticado' },
    { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
  )

  return copyResponseCookies(response, unauthorized)
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const isApiRoute = request.nextUrl.pathname === '/api' || request.nextUrl.pathname.startsWith('/api/')
  const isPublicProposal = request.nextUrl.pathname.startsWith('/proposta/')
  const isPublicArt = request.nextUrl.pathname.startsWith('/arte/')
  if (isPublicProposal || isPublicArt) return response
  let config: ReturnType<typeof getSupabasePublicConfig>
  const hadSession = hasSupabaseAuthCookie(
    request.cookies.getAll().map(({ name }) => name)
  )

  try {
    config = getSupabasePublicConfig()
  } catch (error) {
    console.error('Configuração de autenticação indisponível:', error)
    if (request.nextUrl.pathname === LOGIN_PATH) return response
    return redirectToLogin(request, response, 'configuration')
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  let authenticated = false
  try {
    const { data, error } = await supabase.auth.getClaims()
    authenticated = !error && Boolean(data?.claims?.sub)
  } catch (error) {
    console.error('Falha ao validar a sessão do Supabase:', error)
  }

  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH

  if (!authenticated && !isLoginPage) {
    if (isApiRoute) return unauthorizedApiResponse(response)
    return redirectToLogin(request, response, hadSession ? 'session_expired' : undefined)
  }

  if (authenticated && isLoginPage) {
    const destination = request.nextUrl.clone()
    destination.pathname = DEFAULT_AUTHENTICATED_PATH
    destination.search = ''
    return copyResponseCookies(response, NextResponse.redirect(destination))
  }

  return response
}
