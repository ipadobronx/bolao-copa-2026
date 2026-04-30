import { describe, expect, it } from 'vitest';
import { iniciais } from '@/lib/format/iniciais';

describe('iniciais', () => {
  it('uma palavra → primeira letra maiúscula', () => {
    expect(iniciais('Ana')).toBe('A');
  });

  it('duas palavras → primeira de cada', () => {
    expect(iniciais('Jonatas Pereira')).toBe('JP');
  });

  it('três ou mais palavras → primeira + última', () => {
    expect(iniciais('José Anaíde da Silva')).toBe('JS');
  });

  it('normaliza espaços extras nas pontas e no meio', () => {
    expect(iniciais('  jonatas   pereira  ')).toBe('JP');
  });

  it('uma palavra com whitespace → primeira letra', () => {
    expect(iniciais('  jonatas  ')).toBe('J');
  });

  it('string vazia retorna fallback', () => {
    expect(iniciais('')).toBe('?');
  });

  it('string só com espaços retorna fallback', () => {
    expect(iniciais('   ')).toBe('?');
  });

  it('null retorna fallback', () => {
    expect(iniciais(null)).toBe('?');
  });

  it('undefined retorna fallback', () => {
    expect(iniciais(undefined)).toBe('?');
  });
});
