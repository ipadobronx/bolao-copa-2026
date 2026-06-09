'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { upsertPalpiteSchema, upsertBonusSchema } from './schemas';

export async function upsertPalpite(
  bilheteId: string,
  jogoId: number,
  golsCasa: number,
  golsFora: number,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = upsertPalpiteSchema.safeParse({ bilheteId, jogoId, golsCasa, golsFora });
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: bilhete } = await supabase
    .from('bilhetes')
    .select('user_id, status_pagamento')
    .eq('id', bilheteId)
    .single();

  if (!bilhete || bilhete.user_id !== user.id)
    return { ok: false, error: 'Bilhete não encontrado.' };
  if (bilhete.status_pagamento !== 'confirmado')
    return { ok: false, error: 'Bilhete não confirmado.' };

  const { data: jogo } = await supabase
    .from('jogos')
    .select('data_hora')
    .eq('id', jogoId)
    .single();

  if (!jogo) return { ok: false, error: 'Jogo não encontrado.' };
  if (new Date(jogo.data_hora) <= new Date())
    return { ok: false, error: 'Prazo encerrado para este jogo.' };

  // Escrita pela fronteira confiável: posse, status e janela já foram validados
  // acima. O service_role evita falhas silenciosas de interação RLS no
  // ON CONFLICT DO UPDATE; a trigger prevent_palpite_after_start continua
  // rodando (independe de role) como defesa em profundidade. O .select()
  // confirma que a linha foi de fato persistida — sem ele, um write de 0 linhas
  // viraria um "✓ Salvo" fantasma.
  const admin = createSupabaseAdminClient();
  const { data: salvo, error } = await admin
    .from('palpites')
    .upsert(
      { bilhete_id: bilheteId, jogo_id: jogoId, gols_casa: golsCasa, gols_fora: golsFora },
      { onConflict: 'bilhete_id,jogo_id' },
    )
    .select('jogo_id, gols_casa, gols_fora')
    .single();

  if (error || !salvo) {
    console.error('[upsertPalpite] falha ao gravar', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      bilheteId,
      jogoId,
      userId: user.id,
      persistiu: Boolean(salvo),
    });
    return {
      ok: false,
      error: `Erro ao salvar. Tente novamente.${error?.code ? ` (${error.code})` : ''}`,
    };
  }

  return { ok: true };
}

export async function upsertBonus(
  bilheteId: string,
  tipo: string,
  selecaoId?: number,
  jogadorNome?: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = upsertBonusSchema.safeParse({ bilheteId, tipo, selecaoId, jogadorNome });
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: bilhete } = await supabase
    .from('bilhetes')
    .select('user_id, status_pagamento')
    .eq('id', bilheteId)
    .single();

  if (!bilhete || bilhete.user_id !== user.id)
    return { ok: false, error: 'Bilhete não encontrado.' };
  if (bilhete.status_pagamento !== 'confirmado')
    return { ok: false, error: 'Bilhete não confirmado.' };

  const { data: primeiroJogo } = await supabase
    .from('jogos')
    .select('data_hora')
    .order('data_hora', { ascending: true })
    .limit(1)
    .single();

  if (primeiroJogo && new Date(primeiroJogo.data_hora) <= new Date())
    return { ok: false, error: 'Prazo de bônus encerrado.' };

  // Mesma fronteira confiável do upsertPalpite: validações acima + write via
  // service_role com .select() de verificação. A trigger
  // prevent_bonus_when_unconfirmed continua barrando bilhete não-confirmado.
  const admin = createSupabaseAdminClient();
  const { data: salvo, error } = await admin
    .from('palpites_bonus')
    .upsert(
      {
        bilhete_id: bilheteId,
        tipo: parsed.data.tipo,
        selecao_id: selecaoId ?? null,
        jogador_nome: jogadorNome?.trim() ?? null,
      },
      { onConflict: 'bilhete_id,tipo' },
    )
    .select('tipo')
    .single();

  if (error || !salvo) {
    console.error('[upsertBonus] falha ao gravar', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      bilheteId,
      tipo: parsed.data.tipo,
      userId: user.id,
      persistiu: Boolean(salvo),
    });
    return {
      ok: false,
      error: `Erro ao salvar bônus. Tente novamente.${error?.code ? ` (${error.code})` : ''}`,
    };
  }

  return { ok: true };
}
