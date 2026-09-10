import { z } from 'zod'

export const corteSchema = z.object({
  corte_cortador: z.string().nullish(),
  corte_inicio_previsto: z.string().nullish(),
  corte_inicio_real: z.string().nullish(),
  corte_fim_previsto: z.string().nullish(),
  corte_fim_real: z.string().nullish(),
  corte_consumo_tecido: z.coerce.number().nullish(),
  corte_codigo_ribana: z.string().nullish(),
  corte_consumo_ribana: z.coerce.number().nullish(),
  corte_codigo_gola: z.string().nullish(),
  corte_consumo_gola: z.coerce.number().nullish(),
  corte_situacao: z.string().nullish(),
  corte_observacoes: z.string().nullish(),
}).strict()
