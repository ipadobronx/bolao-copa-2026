import { z } from 'zod';

export const loginSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome precisa ter pelo menos 2 caracteres.')
    .max(80, 'Nome muito longo.'),
  email: z.string().trim().toLowerCase().email('Email inválido.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
