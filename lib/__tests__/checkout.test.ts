import { describe, expect, it } from 'vitest';
import { montarPayloadMP, mapearStatusMP } from '@/lib/checkout';

describe('lib/checkout — montarPayloadMP', () => {
  const base = {
    qty: 5,
    user_email: 'jonatas@example.com',
    bilhete_principal_id: '11111111-1111-1111-1111-111111111111',
    expira_em: '2026-04-30T18:00:00.000Z',
  };

  it('transaction_amount = qty × 20', () => {
    const payload = montarPayloadMP(base);
    expect(payload.transaction_amount).toBe(100);
  });

  it('description menciona "tabelas" no plural', () => {
    expect(montarPayloadMP({ ...base, qty: 5 }).description).toBe(
      'Bolão Copa 2026 — 5 tabelas',
    );
  });

  it('description usa "tabela" singular quando qty=1', () => {
    expect(montarPayloadMP({ ...base, qty: 1 }).description).toBe(
      'Bolão Copa 2026 — 1 tabela',
    );
  });

  it('payment_method_id === "pix"', () => {
    expect(montarPayloadMP(base).payment_method_id).toBe('pix');
  });

  it('payer.email é o user_email passado', () => {
    expect(montarPayloadMP(base).payer.email).toBe('jonatas@example.com');
  });

  it('payer.first_name é incluído quando user_name é passado', () => {
    expect(montarPayloadMP({ ...base, user_name: 'Jonatas' }).payer).toEqual({
      email: 'jonatas@example.com',
      first_name: 'Jonatas',
    });
  });

  it('payer.first_name é OMITIDO quando user_name é undefined', () => {
    const payload = montarPayloadMP(base);
    expect(payload.payer).toEqual({ email: 'jonatas@example.com' });
    expect('first_name' in payload.payer).toBe(false);
  });

  it('external_reference é o bilhete_principal_id', () => {
    expect(montarPayloadMP(base).external_reference).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
  });

  it('date_of_expiration é o expira_em passado', () => {
    expect(montarPayloadMP(base).date_of_expiration).toBe('2026-04-30T18:00:00.000Z');
  });

  it('lança em qty < 1', () => {
    expect(() => montarPayloadMP({ ...base, qty: 0 })).toThrow('qty deve estar entre 1 e 50');
  });

  it('lança em qty > 50', () => {
    expect(() => montarPayloadMP({ ...base, qty: 51 })).toThrow(
      'qty deve estar entre 1 e 50',
    );
  });

  it('aceita qty=1 e qty=50 (limites)', () => {
    expect(() => montarPayloadMP({ ...base, qty: 1 })).not.toThrow();
    expect(() => montarPayloadMP({ ...base, qty: 50 })).not.toThrow();
  });
});

describe('lib/checkout — mapearStatusMP', () => {
  it.each([
    ['pending', 'pendente'],
    ['in_process', 'pendente'],
    ['in_mediation', 'pendente'],
    ['authorized', 'pendente'],
    ['approved', 'confirmado'],
    ['cancelled', 'cancelado'],
    ['rejected', 'cancelado'],
    ['refunded', 'cancelado'],
    ['charged_back', 'cancelado'],
  ] as const)('"%s" → "%s"', (input, expected) => {
    expect(mapearStatusMP(input, '')).toBe(expected);
  });

  it('lança em status desconhecido (fail-closed)', () => {
    expect(() => mapearStatusMP('hibernating', '')).toThrow(
      'Status MP desconhecido: hibernating',
    );
  });

  it('status_detail não afeta mapeamento (atualmente ignorado)', () => {
    expect(mapearStatusMP('approved', 'whatever')).toBe('confirmado');
  });
});
