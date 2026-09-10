import type { CustomizationType } from '@/types/quotes'

export const CUSTOMIZATION_OPTIONS: ReadonlyArray<{ value: CustomizationType; label: string; orderLabel: string | null }> = [
  { value: 'none', label: 'Sem personalização', orderLabel: null },
  { value: 'embroidery', label: 'Bordado', orderLabel: 'BORDADO' },
  { value: 'silk', label: 'Silk', orderLabel: 'SILK' },
  { value: 'dtf', label: 'DTF', orderLabel: 'DTF' },
  { value: 'sublimation', label: 'Sublimação', orderLabel: 'SUBLIMAÇÃO' },
  { value: 'other', label: 'Outro', orderLabel: 'OUTRO' },
]

export function customizationLabel(value: string) {
  return CUSTOMIZATION_OPTIONS.find((option) => option.value === value)?.label ?? value
}
