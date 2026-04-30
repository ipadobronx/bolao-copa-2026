import { describe, expect, it } from 'vitest';
import { safeNext } from '@/lib/validators/next';

describe('safeNext', () => {
  it('aceita caminho interno simples', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard');
  });

  it('aceita caminho interno com query string', () => {
    expect(safeNext('/dashboard?tab=jogos')).toBe('/dashboard?tab=jogos');
  });

  it('aceita caminho interno aninhado', () => {
    expect(safeNext('/palpites/123')).toBe('/palpites/123');
  });

  it('rejeita URL absoluta http', () => {
    expect(safeNext('http://evil.com')).toBe('/dashboard');
  });

  it('rejeita URL absoluta https', () => {
    expect(safeNext('https://evil.com')).toBe('/dashboard');
  });

  it('rejeita protocol-relative URL', () => {
    expect(safeNext('//evil.com')).toBe('/dashboard');
  });

  it('rejeita string sem barra inicial', () => {
    expect(safeNext('dashboard')).toBe('/dashboard');
  });

  it('rejeita null', () => {
    expect(safeNext(null)).toBe('/dashboard');
  });

  it('rejeita undefined', () => {
    expect(safeNext(undefined)).toBe('/dashboard');
  });

  it('rejeita string vazia', () => {
    expect(safeNext('')).toBe('/dashboard');
  });

  it('aceita fallback customizado', () => {
    expect(safeNext('//evil.com', '/login')).toBe('/login');
  });
});
