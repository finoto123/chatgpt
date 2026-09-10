export const LAYOUT_BUCKET = 'pedidos-layouts'
export const LAYOUT_MAX_BYTES = 10 * 1024 * 1024

export const LAYOUT_FILE_TYPES = {
  pdf: { mime: 'application/pdf', signatures: [[0x25, 0x50, 0x44, 0x46, 0x2d]] },
  png: { mime: 'image/png', signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  jpg: { mime: 'image/jpeg', signatures: [[0xff, 0xd8, 0xff]] },
  jpeg: { mime: 'image/jpeg', signatures: [[0xff, 0xd8, 0xff]] },
  webp: { mime: 'image/webp', signatures: [] },
} as const

export type LayoutExtension = keyof typeof LAYOUT_FILE_TYPES

export type LayoutValidation =
  | { ok: true; extension: LayoutExtension; mime: string }
  | { ok: false; message: string }

function matches(bytes: Uint8Array, signature: readonly number[], offset = 0) {
  return signature.every((value, index) => bytes[index + offset] === value)
}

export function validateLayoutFile(
  name: string,
  browserMime: string,
  size: number,
  bytes: Uint8Array,
): LayoutValidation {
  if (size <= 0) return { ok: false, message: 'O arquivo está vazio.' }
  if (size > LAYOUT_MAX_BYTES) {
    return { ok: false, message: 'Arquivo muito grande. O limite é 10 MiB.' }
  }

  const rawExtension = name.split('.').pop()?.toLowerCase()
  if (!rawExtension || !(rawExtension in LAYOUT_FILE_TYPES)) {
    return { ok: false, message: 'Formato inválido. Envie PDF, PNG, JPG ou WEBP.' }
  }

  const extension = rawExtension as LayoutExtension
  const expected = LAYOUT_FILE_TYPES[extension]
  if (browserMime !== expected.mime) {
    return { ok: false, message: 'A extensão e o tipo informado do arquivo não correspondem.' }
  }

  const validMagic = extension === 'webp'
    ? matches(bytes, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, [0x57, 0x45, 0x42, 0x50], 8)
    : expected.signatures.some((signature) => matches(bytes, signature))

  if (!validMagic) {
    return { ok: false, message: 'O conteúdo do arquivo não corresponde ao formato informado.' }
  }

  return { ok: true, extension, mime: expected.mime }
}

export function createLayoutStoragePath(pedidoId: string, extension: LayoutExtension) {
  return `${pedidoId}/${crypto.randomUUID()}.${extension === 'jpeg' ? 'jpg' : extension}`
}

export function createArtStoragePath(pedidoId: string, extension: LayoutExtension) {
  return `${pedidoId}/art/${crypto.randomUUID()}.${extension === 'jpeg' ? 'jpg' : extension}`
}

export function extractLayoutStoragePath(value: string | null | undefined) {
  if (!value) return null
  if (/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png|jpe?g|webp)$/i.test(value)) return value
  try {
    const pathname = new URL(value).pathname
    const match = pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/pedidos-layouts\/(.+)$/)
    return match?.[1] ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}
