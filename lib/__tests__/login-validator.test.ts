import { describe, expect, it } from 'vitest';
import { loginSchema } from '@/lib/validators/login';

describe('loginSchema', () => {
  it('aceita nome e email válidos', () => {
    const out = loginSchema.parse({ nome: 'Jonatas Pereira', email: 'jonatas@example.com' });
    expect(out).toEqual({ nome: 'Jonatas Pereira', email: 'jonatas@example.com' });
  });

  it('faz trim do nome e email', () => {
    const out = loginSchema.parse({ nome: '  Jonatas  ', email: '  jonatas@example.com  ' });
    expect(out.nome).toBe('Jonatas');
    expect(out.email).toBe('jonatas@example.com');
  });

  it('lowercase no email', () => {
    const out = loginSchema.parse({ nome: 'Jonatas', email: 'JONATAS@EXAMPLE.com' });
    expect(out.email).toBe('jonatas@example.com');
  });

  it('rejeita nome com 1 caractere', () => {
    const result = loginSchema.safeParse({ nome: 'A', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejeita nome só com whitespace (vira string vazia após trim)', () => {
    const result = loginSchema.safeParse({ nome: '   ', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejeita nome maior que 80 caracteres', () => {
    const result = loginSchema.safeParse({ nome: 'a'.repeat(81), email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejeita email mal-formado', () => {
    const result = loginSchema.safeParse({ nome: 'Jonatas', email: 'nao-eh-email' });
    expect(result.success).toBe(false);
  });

  it('mensagens de erro vêm em pt-BR', () => {
    const result = loginSchema.safeParse({ nome: 'A', email: 'nao-eh-email' });
    if (result.success) throw new Error('expected failure');
    const errors = result.error.flatten().fieldErrors;
    expect(errors.nome?.[0]).toMatch(/pelo menos 2 caracteres/i);
    expect(errors.email?.[0]).toMatch(/email inválido/i);
  });
});
