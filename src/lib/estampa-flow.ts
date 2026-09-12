import { StatusPedido } from '@/types'

export function parseTiposEstampa(tipoEstampa: string | null | undefined) {
  return (tipoEstampa ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function hasBordado(tipoEstampa: string | null | undefined) {
  return parseTiposEstampa(tipoEstampa).some(tipo => normalize(tipo).includes('bordado'))
}

export function hasDtf(tipoEstampa: string | null | undefined) {
  return parseTiposEstampa(tipoEstampa).some(tipo => normalize(tipo).includes('dtf'))
}

export function hasEstampa(tipoEstampa: string | null | undefined) {
  return parseTiposEstampa(tipoEstampa).some(tipo => !normalize(tipo).includes('bordado'))
}

export function getPrimeiraEtapaDepoisCorte(
  tipoEstampa: string | null | undefined,
  etapasAtivas: string[] | null | undefined
): StatusPedido {
  const etapas = etapasAtivas ?? ['corte', 'costura']
  const temEstampa = etapas.includes('estampa')
  const temCostura = etapas.includes('costura')

  if (temEstampa) {
    if (hasBordado(tipoEstampa)) return 'bordados'
    if (hasDtf(tipoEstampa)) return 'dtf'
    if (hasEstampa(tipoEstampa)) return 'sublimacao'
  }
  if (temCostura) return 'costura'
  return 'acabamento'
}

export function getEtapaDepoisBordado(
  tipoEstampa: string | null | undefined,
  etapasAtivas: string[] | null | undefined
): StatusPedido {
  const etapas = etapasAtivas ?? ['corte', 'costura']
  const temEstampa = etapas.includes('estampa')
  const temCostura = etapas.includes('costura')

  if (temEstampa) {
    if (hasDtf(tipoEstampa)) return 'dtf'
    if (hasEstampa(tipoEstampa)) return 'sublimacao'
  }
  if (temCostura) return 'costura'
  return 'acabamento'
}

export function getEtapaDepoisEstampa(
  tipoEstampa: string | null | undefined,
  etapasAtivas: string[] | null | undefined
): StatusPedido {
  const etapas = etapasAtivas ?? ['corte', 'costura']
  const temEstampa = etapas.includes('estampa')
  const temCostura = etapas.includes('costura')

  if (temEstampa) {
    if (hasBordado(tipoEstampa)) return 'bordados'
  }
  if (temCostura) return 'costura'
  return 'acabamento'
}

export function getEtapaDepoisDtf(
  _tipoEstampa: string | null | undefined,
  etapasAtivas: string[] | null | undefined
): StatusPedido {
  const etapas = etapasAtivas ?? ['corte', 'costura']
  const temCostura = etapas.includes('costura')

  if (temCostura) return 'costura'
  return 'acabamento'
}
