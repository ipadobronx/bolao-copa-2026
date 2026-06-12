import type { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { classificarPalpite, type ClassePalpite, type FaseJogo } from '@/lib/pontuacao'
import { emojiDoResultado } from '@/lib/ranking/badge'

type Admin = ReturnType<typeof createSupabaseAdminClient>

export type UsuarioBadge = { userId: string; melhorBilheteId: string | null }

function diaBRT(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Retorna Map<userId, emoji> para o último jogo finalizado da Copa.
 * Vazio se ainda não há jogo finalizado. Usa o cliente service_role (server-only).
 */
export async function calcularBadges(
  admin: Admin,
  usuarios: UsuarioBadge[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const bilheteIds = usuarios
    .map((u) => u.melhorBilheteId)
    .filter((id): id is string => Boolean(id))
  if (bilheteIds.length === 0) return result

  const { data: ultimo } = await admin
    .from('jogos')
    .select('id, fase, data_hora, gols_casa, gols_fora')
    .eq('finalizado', true)
    .order('data_hora', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!ultimo || ultimo.gols_casa === null || ultimo.gols_fora === null) return result

  const alvoDia = diaBRT(ultimo.data_hora)
  const { data: jogosFin } = await admin
    .from('jogos')
    .select('id, data_hora')
    .eq('finalizado', true)
  const idsDia = (jogosFin ?? [])
    .filter((j) => diaBRT(j.data_hora) === alvoDia)
    .map((j) => j.id)

  const { data: palpUltimo } = await admin
    .from('palpites')
    .select('bilhete_id, gols_casa, gols_fora')
    .eq('jogo_id', ultimo.id)
    .in('bilhete_id', bilheteIds)
  const classePorBilhete = new Map<string, ClassePalpite>()
  for (const p of palpUltimo ?? []) {
    classePorBilhete.set(
      p.bilhete_id,
      classificarPalpite(
        { gols_casa: p.gols_casa, gols_fora: p.gols_fora },
        {
          fase: ultimo.fase as FaseJogo,
          finalizado: true,
          gols_casa: ultimo.gols_casa,
          gols_fora: ultimo.gols_fora,
        },
      ),
    )
  }

  const pontosDia = new Map<string, number>()
  if (idsDia.length > 0) {
    const { data: palpDia } = await admin
      .from('palpites')
      .select('bilhete_id, pontos_calculados')
      .in('jogo_id', idsDia)
      .in('bilhete_id', bilheteIds)
    for (const p of palpDia ?? []) {
      pontosDia.set(p.bilhete_id, (pontosDia.get(p.bilhete_id) ?? 0) + (p.pontos_calculados ?? 0))
    }
  }

  for (const u of usuarios) {
    if (!u.melhorBilheteId) continue
    const classe = classePorBilhete.get(u.melhorBilheteId) ?? null
    const pts = pontosDia.get(u.melhorBilheteId) ?? 0
    result.set(u.userId, emojiDoResultado(classe, pts))
  }
  return result
}
