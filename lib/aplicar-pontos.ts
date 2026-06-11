import type { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { UpdatePayload } from '@/lib/recalculo';

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Grava pontos_calculados de uma lista de UpdatePayload.
 *
 * Usa UPDATE (agrupado por valor de pontos) em vez de upsert parcial: um
 * `upsert([{id, pontos_calculados}], {onConflict:'id'})` falha com violação de
 * NOT NULL em bilhete_id/jogo_id — o INSERT do ON CONFLICT não tem as colunas
 * obrigatórias. UPDATE por id não tem esse problema.
 *
 * Lança Error na primeira falha do banco (caller decide como reportar).
 */
export async function aplicarPontos(
  admin: AdminClient,
  tabela: 'palpites' | 'palpites_bonus',
  updates: UpdatePayload[],
): Promise<void> {
  if (updates.length === 0) return;

  // Agrupa ids por valor de pontos → poucas queries (1 por valor distinto).
  const porPontos = new Map<number, string[]>();
  for (const u of updates) {
    const ids = porPontos.get(u.pontos_calculados) ?? [];
    ids.push(u.id);
    porPontos.set(u.pontos_calculados, ids);
  }

  for (const [pontos, ids] of porPontos) {
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);
      const { error } = await (admin as unknown as {
        from: (t: string) => {
          update: (v: { pontos_calculados: number }) => {
            in: (col: string, vals: string[]) => Promise<{ error: { message: string } | null }>;
          };
        };
      })
        .from(tabela)
        .update({ pontos_calculados: pontos })
        .in('id', lote);
      if (error) throw new Error(`aplicarPontos(${tabela}): ${error.message}`);
    }
  }
}
