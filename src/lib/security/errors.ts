import 'server-only'

export type AppErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | (string & {})

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly safeMessage: string,
    public readonly status: number,
    options?: ErrorOptions,
  ) {
    super(safeMessage, options)
    this.name = 'AppError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Faça login para continuar.') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Você não possui permissão para esta ação.') {
    super('FORBIDDEN', message, 403)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Revise os dados informados.') {
    super('VALIDATION_FAILED', message, 400)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Registro não encontrado.') {
    super('NOT_FOUND', message, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Não foi possível concluir por conflito de dados.') {
    super('CONFLICT', message, 409)
  }
}

const SENSITIVE_KEY = /password|senha|token|secret|service.?role|cookie|authorization|api.?key/i

export function sanitizeLogContext(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[limite de profundidade]'
  if (value instanceof Error) {
    return { name: value.name, message: value.message }
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeLogContext(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).flatMap(([key, item]) =>
      SENSITIVE_KEY.test(key) ? [] : [[key, sanitizeLogContext(item, depth + 1)]]))
  }
  return value
}

export function reportServerError(
  error: unknown,
  context: { action: string; userId?: string; entity?: string; entityId?: string },
) {
  console.error('Erro de aplicação', {
    ...sanitizeLogContext(context) as object,
    timestamp: new Date().toISOString(),
    error: sanitizeLogContext(error),
  })
}

export function safeActionFailure(
  error: unknown,
  code: AppErrorCode,
  message: string,
  context: { action: string; userId?: string; entity?: string; entityId?: string },
) {
  reportServerError(error, context)
  const appError = error instanceof AppError ? error : null
  return {
    success: false as const,
    error: appError?.safeMessage ?? message,
    errorCode: appError?.code ?? code,
  }
}

export function safeDatabaseError(
  error: unknown,
  fallback: string,
  context: { action: string; userId?: string; entity?: string; entityId?: string },
) {
  reportServerError(error, context)
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : ''
  if (code === '42501') return 'Você não possui permissão para esta alteração.'
  if (code === '23505') return 'Já existe um registro com estes dados.'
  if (code === '23503') return 'Este registro está relacionado a outros dados e não pode ser alterado.'
  if (code === '23502') return 'O banco exige um campo que não foi preenchido.'
  if (code === '22023' || code === '22P02') return 'Um dos valores do pedido é inválido.'
  if (code === 'PGRST202' || code === '42883') return 'A função de salvamento de rascunhos ainda não foi instalada no banco.'
  return fallback
}
