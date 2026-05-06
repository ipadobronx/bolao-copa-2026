import { describe, expect, it } from 'vitest';
import { loginSchema, signupSchema } from '@/lib/validators/login';

describe('loginSchema (email + senha)', () => {
  it('aceita email e senha válidos', () => {
    const out = loginSchema.parse({ email: 'jonatas@example.com', password: '123456' });
    expect(out).toEqual({ email: 'jonatas@example.com', password: '123456' });
  });

  it('lowercase no email', () => {
    const out = loginSchema.parse({ email: 'JONATAS@EXAMPLE.com', password: '123456' });
    expect(out.email).toBe('jonatas@example.com');
  });

  it('rejeita email mal-formado', () => {
    const result = loginSchema.safeParse({ email: 'nao-eh-email', password: '123456' });
    expect(result.success).toBe(false);
  });

  it('rejeita senha com menos de 6 caracteres', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: '123' });
    expect(result.success).toBe(false);
  });

  it('mensagens de erro em pt-BR', () => {
    const result = loginSchema.safeParse({ email: 'nao-eh-email', password: '123' });
    if (result.success) throw new Error('expected failure');
    const errors = result.error.flatten().fieldErrors;
    expect(errors.email?.[0]).toMatch(/email inválido/i);
    expect(errors.password?.[0]).toMatch(/curta/i);
  });
});

describe('signupSchema (nome + email + senha)', () => {
  it('aceita dados válidos', () => {
    const out = signupSchema.parse({ nome: 'Jonatas', email: 'jonatas@example.com', password: '123456' });
    expect(out.nome).toBe('Jonatas');
    expect(out.email).toBe('jonatas@example.com');
  });

  it('faz trim no nome', () => {
    const out = signupSchema.parse({ nome: '  Jonatas  ', email: 'a@b.com', password: '123456' });
    expect(out.nome).toBe('Jonatas');
  });

  it('rejeita nome com 1 caractere', () => {
    const result = signupSchema.safeParse({ nome: 'A', email: 'a@b.com', password: '123456' });
    expect(result.success).toBe(false);
  });

  it('rejeita nome maior que 80 caracteres', () => {
    const result = signupSchema.safeParse({ nome: 'a'.repeat(81), email: 'a@b.com', password: '123456' });
    expect(result.success).toBe(false);
  });

  it('mensagens de erro em pt-BR', () => {
    const result = signupSchema.safeParse({ nome: 'A', email: 'nao-eh-email', password: '123' });
    if (result.success) throw new Error('expected failure');
    const errors = result.error.flatten().fieldErrors;
    expect(errors.nome?.[0]).toMatch(/pelo menos 2 caracteres/i);
    expect(errors.email?.[0]).toMatch(/email inválido/i);
    expect(errors.password?.[0]).toMatch(/mínimo 6/i);
  });
});
