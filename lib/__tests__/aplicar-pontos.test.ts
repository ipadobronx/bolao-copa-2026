import { describe, it, expect } from 'vitest';
import { aplicarPontos } from '../aplicar-pontos';

type Call = { tabela: string; pontos: number; ids: string[] };

function mockAdmin(errorMsg?: string) {
  const calls: Call[] = [];
  const admin = {
    from: (tabela: string) => ({
      update: (v: { pontos_calculados: number }) => ({
        in: async (_col: string, ids: string[]) => {
          calls.push({ tabela, pontos: v.pontos_calculados, ids });
          return { error: errorMsg ? { message: errorMsg } : null };
        },
      }),
    }),
  };
  return { admin, calls };
}

describe('aplicarPontos', () => {
  it('agrupa por valor de pontos e atualiza por id', async () => {
    const { admin, calls } = mockAdmin();
    await aplicarPontos(admin as never, 'palpites', [
      { id: 'a', pontos_calculados: 10 },
      { id: 'b', pontos_calculados: 5 },
      { id: 'c', pontos_calculados: 10 },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls.find((c) => c.pontos === 10)!.ids.sort()).toEqual(['a', 'c']);
    expect(calls.find((c) => c.pontos === 5)!.ids).toEqual(['b']);
    expect(calls.every((c) => c.tabela === 'palpites')).toBe(true);
  });

  it('é no-op com lista vazia', async () => {
    const { admin, calls } = mockAdmin();
    await aplicarPontos(admin as never, 'palpites_bonus', []);
    expect(calls).toHaveLength(0);
  });

  it('lança quando o banco retorna erro', async () => {
    const { admin } = mockAdmin('boom');
    await expect(
      aplicarPontos(admin as never, 'palpites', [{ id: 'a', pontos_calculados: 1 }]),
    ).rejects.toThrow(/boom/);
  });

  it('faz chunk de >100 ids em múltiplas queries', async () => {
    const { admin, calls } = mockAdmin();
    const updates = Array.from({ length: 250 }, (_, i) => ({ id: `id${i}`, pontos_calculados: 5 }));
    await aplicarPontos(admin as never, 'palpites', updates);
    expect(calls).toHaveLength(3); // 100 + 100 + 50
    expect(calls.reduce((n, c) => n + c.ids.length, 0)).toBe(250);
  });
});
