import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));

import { upsertBonusSchema, upsertPalpiteSchema } from '../schemas';

describe('upsertPalpiteSchema', () => {
  it('aceita dados válidos', () => {
    const result = upsertPalpiteSchema.safeParse({
      bilheteId: '00000000-0000-0000-0000-000000000001',
      jogoId: 1,
      golsCasa: 2,
      golsFora: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita gols negativos', () => {
    const result = upsertPalpiteSchema.safeParse({
      bilheteId: '00000000-0000-0000-0000-000000000001',
      jogoId: 1,
      golsCasa: -1,
      golsFora: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita gols > 99', () => {
    const result = upsertPalpiteSchema.safeParse({
      bilheteId: '00000000-0000-0000-0000-000000000001',
      jogoId: 1,
      golsCasa: 100,
      golsFora: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita bilheteId que não é UUID', () => {
    const result = upsertPalpiteSchema.safeParse({
      bilheteId: 'nao-um-uuid',
      jogoId: 1,
      golsCasa: 1,
      golsFora: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita gols decimais', () => {
    const result = upsertPalpiteSchema.safeParse({
      bilheteId: '00000000-0000-0000-0000-000000000001',
      jogoId: 1,
      golsCasa: 1.5,
      golsFora: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('upsertBonusSchema — selecao (campeao/vice/terceiro/quarto/revelacao)', () => {
  it('aceita tipo campeao com selecaoId', () => {
    const result = upsertBonusSchema.safeParse({
      bilheteId: '00000000-0000-0000-0000-000000000001',
      tipo: 'campeao',
      selecaoId: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita tipo campeao sem selecaoId', () => {
    const result = upsertBonusSchema.safeParse({
      bilheteId: '00000000-0000-0000-0000-000000000001',
      tipo: 'campeao',
    });
    expect(result.success).toBe(false);
  });
});

describe('upsertBonusSchema — artilheiro', () => {
  it('aceita artilheiro com jogadorNome', () => {
    const result = upsertBonusSchema.safeParse({
      bilheteId: '00000000-0000-0000-0000-000000000001',
      tipo: 'artilheiro',
      jogadorNome: 'Vinicius Jr.',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita artilheiro com nome vazio', () => {
    const result = upsertBonusSchema.safeParse({
      bilheteId: '00000000-0000-0000-0000-000000000001',
      tipo: 'artilheiro',
      jogadorNome: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita artilheiro sem jogadorNome', () => {
    const result = upsertBonusSchema.safeParse({
      bilheteId: '00000000-0000-0000-0000-000000000001',
      tipo: 'artilheiro',
    });
    expect(result.success).toBe(false);
  });
});
