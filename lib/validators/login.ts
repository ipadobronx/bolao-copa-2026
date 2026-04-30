import { z } from 'zod';

// nome é opcional (string vazia aceita) pra usuários recorrentes que só
// digitam o email. signInWithOtp's `data` field só persiste em raw_user_meta_data
// no PRIMEIRO signup; em re-logins do mesmo email é ignorado de qualquer jeito.
// Quando o user de fato digita um nome, exigimos pelo menos 2 chars pra não aceitar
// "A" como nome de signup.
export const loginSchema = z.object({
  nome: z
    .string()
    .trim()
    .max(80, 'Nome muito longo.')
    .refine((val) => val === '' || val.length >= 2, {
      message: 'Nome precisa ter pelo menos 2 caracteres.',
    }),
  email: z.string().trim().toLowerCase().email('Email inválido.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
