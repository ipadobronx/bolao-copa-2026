import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido.'),
  password: z.string().min(6, 'Senha muito curta.'),
});

export const signupSchema = z.object({
  nome: z.string().trim().min(2, 'Nome precisa ter pelo menos 2 caracteres.').max(80, 'Nome muito longo.'),
  email: z.string().trim().toLowerCase().email('Email inválido.'),
  password: z.string().min(6, 'Senha mínimo 6 caracteres.'),
});

export const recuperarSenhaSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido.'),
});

export const redefinirSenhaSchema = z
  .object({
    password: z.string().min(6, 'Senha mínimo 6 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type RecuperarSenhaInput = z.infer<typeof recuperarSenhaSchema>;
export type RedefinirSenhaInput = z.infer<typeof redefinirSenhaSchema>;
