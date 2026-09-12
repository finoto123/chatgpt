import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AuthorizationProvider } from '@/components/providers/AuthorizationProvider'
import { getOptionalAuthorizationContext } from '@/lib/auth/require-user'

export const metadata: Metadata = {
  title: 'Selma Bordados — Gestão Comercial e Operacional',
  description: 'Sistema integrado de atendimento, vendas e produção de uniformes',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const context = await getOptionalAuthorizationContext()
  const authorization = context ? {
    active: context.profile.active,
    permissions: context.permissions,
    profile: {
      fullName: context.profile.full_name,
      email: context.profile.email,
    },
    primaryRole: context.primaryRole ? {
      code: context.primaryRole.code,
      name: context.primaryRole.name,
    } : null,
  } : null

  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-full" style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}>
        <ThemeProvider>
          <AuthorizationProvider authorization={authorization}>
            <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible print:block">
              <Sidebar />
              <div className="flex-1 flex flex-col overflow-hidden print:h-auto print:overflow-visible print:block">
                <main className="flex-1 overflow-y-auto print:h-auto print:overflow-visible print:block" style={{ backgroundColor: 'var(--bg)' }}>
                  {children}
                </main>
              </div>
            </div>
            <Toaster richColors position="top-right" />
          </AuthorizationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
