'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { login, type LoginState } from './actions'

const initialState: LoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={[
        'mt-2 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition',
        'hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
      ].join(' ')}
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction] = useActionState(login, initialState)
  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={nextPath ?? ''} />
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
          E-mail
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          className={[
            'w-full rounded-lg border border-[var(--border-medium)] bg-[var(--input-bg)] px-3 py-3 text-sm outline-none',
            'text-[var(--fg)] transition focus:ring-2 focus:ring-green-500',
          ].join(' ')}
          placeholder="seu@email.com"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
          Senha
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={[
            'w-full rounded-lg border border-[var(--border-medium)] bg-[var(--input-bg)] px-3 py-3 text-sm outline-none',
            'text-[var(--fg)] transition focus:ring-2 focus:ring-green-500',
          ].join(' ')}
          placeholder="Sua senha"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  )
}
