import { z } from 'zod';

export const upsertPalpiteSchema = z.object({
  bilheteId: z.string().uuid(),
  jogoId: z.number().int().positive(),
  golsCasa: z.number().int().min(0).max(99),
  golsFora: z.number().int().min(0).max(99),
});

export const upsertBonusSchema = z.discriminatedUnion('tipo', [
  z.object({
    bilheteId: z.string().uuid(),
    tipo: z.enum(['campeao', 'vice', 'terceiro', 'quarto', 'revelacao']),
    selecaoId: z.number().int().positive(),
    jogadorNome: z.string().optional(),
  }),
  z.object({
    bilheteId: z.string().uuid(),
    tipo: z.literal('artilheiro'),
    selecaoId: z.number().optional(),
    jogadorNome: z.string().trim().min(1, 'Nome obrigatório').max(100),
  }),
]);
