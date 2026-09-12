import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: string | Date | null | undefined, pattern = 'dd/MM/yyyy'): string {
  if (!date) return '--'
  try {
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
    return format(d, pattern, { locale: ptBR })
  } catch {
    return '--'
  }
}

export function formatDateShort(date: string | Date | null | undefined): string {
  return formatDate(date, 'dd-MMM')
}

export function isAtrasado(dataEntrega: string | null | undefined): boolean {
  if (!dataEntrega) return false
  return new Date(dataEntrega + 'T00:00:00') < new Date()
}

export function calcularRestoPagar(total: number, entrada: number): number {
  return Math.max(0, total - entrada)
}

export function formatTamanho(tam: string | number | null | undefined): string {
  if (tam === null || tam === undefined) return '—'
  const s = String(tam)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function formatModelo(modelo: string | null | undefined): string {
  if (!modelo) return '—'
  return modelo
}

export function parseModeloParts(item: { modelo?: string | null, manga?: string | null, gola?: string | null, acabamento?: string | null }) {
  const defaults = {
    modelo: item.modelo || '',
    manga: item.manga || '',
    gola: item.gola || '',
    acabamento: item.acabamento || ''
  }

  if (!item.modelo) return defaults

  const texto = item.modelo.toUpperCase().trim()
  const chaveSemEspaco = texto.replace(/\./g, '').replace(/\s+/g, '')

  const mapeamento: Record<string, { modelo: string, manga: string, gola: string }> = {
    // Siglas
    'CMCGR': { modelo: 'Camiseta', manga: 'Curta', gola: 'Redonda' },
    'CMLGR': { modelo: 'Camiseta', manga: 'Longa', gola: 'Redonda' },
    'CMCGV': { modelo: 'Camiseta', manga: 'Curta', gola: 'V' },
    'CMLGV': { modelo: 'Camiseta', manga: 'Longa', gola: 'V' },
    'BLMCGR': { modelo: 'Baby Look', manga: 'Curta', gola: 'Redonda' },
    'BLMLGR': { modelo: 'Baby Look', manga: 'Longa', gola: 'Redonda' },
    'BLMCGV': { modelo: 'Baby Look', manga: 'Curta', gola: 'V' },
    'BLMLGV': { modelo: 'Baby Look', manga: 'Longa', gola: 'V' },
    'PMC':   { modelo: 'Polo', manga: 'Curta', gola: '' },
    'PML':   { modelo: 'Polo', manga: 'Longa', gola: '' },
    
    // Textos completos (sem espaços para matching fácil)
    'CAMISETAMANGACURTAGOLAREDONDA': { modelo: 'Camiseta', manga: 'Curta', gola: 'Redonda' },
    'CAMISETAMANGALONGAGOLAREDONDA': { modelo: 'Camiseta', manga: 'Longa', gola: 'Redonda' },
    'CAMISETAMANGACURTAGOLAV': { modelo: 'Camiseta', manga: 'Curta', gola: 'V' },
    'CAMISETAMANGALONGAGOLAV': { modelo: 'Camiseta', manga: 'Longa', gola: 'V' },
    'BABYLOOKMANGACURTAGOLAREDONDA': { modelo: 'Baby Look', manga: 'Curta', gola: 'Redonda' },
    'BABYLOOKMANGALONGAGOLAREDONDA': { modelo: 'Baby Look', manga: 'Longa', gola: 'Redonda' },
    'BABYLOOKMANGACURTAGOLAV': { modelo: 'Baby Look', manga: 'Curta', gola: 'V' },
    'BABYLOOKMANGALONGAGOLAV': { modelo: 'Baby Look', manga: 'Longa', gola: 'V' },
    'POLOMANGACURTA': { modelo: 'Polo', manga: 'Curta', gola: '' },
    'POLOMANGALONGA': { modelo: 'Polo', manga: 'Longa', gola: '' },
  }

  if (mapeamento[chaveSemEspaco]) {
    const mapa = mapeamento[chaveSemEspaco]
    return {
      modelo: mapa.modelo,
      manga: defaults.manga || mapa.manga,
      gola: defaults.gola || mapa.gola,
      acabamento: defaults.acabamento
    }
  }

  return defaults
}

export function exibirCortador(valor: string | null | undefined): string {
  if (!valor) return '—'
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return '—'
  return valor
}

// Rótulo da etapa de estamparia derivado dos tipos de estampa selecionados.
// Exclui BORDADO (etapa própria) e usa os demais tipos como rótulo.
// Ex: "BORDADO, SUBLIMAÇÃO" -> "SUBLIMAÇÃO" | "DTF" -> "DTF" | só bordado/vazio -> "ESTAMPA"
export function labelEtapaEstampa(tipoEstampa: string | null | undefined): string {
  const tipos = (tipoEstampa ?? '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .filter(t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() !== 'BORDADO')

  return tipos.length > 0 ? tipos.join(', ') : 'ESTAMPA'
}
