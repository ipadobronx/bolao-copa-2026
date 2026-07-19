import type { TipoBonus } from '@/lib/pontuacao'

/** Campos de copa_resultados relevantes pra exibição de pontos de bônus. */
export type CopaResultadosOficial = {
  campeao_id: number | null
  vice_id: number | null
  terceiro_id: number | null
  quarto_id: number | null
  artilheiro_nome: string | null
  revelacao_id: number | null
}

const CAMPO_OFICIAL: Record<TipoBonus, keyof CopaResultadosOficial> = {
  campeao: 'campeao_id',
  vice: 'vice_id',
  terceiro: 'terceiro_id',
  quarto: 'quarto_id',
  artilheiro: 'artilheiro_nome',
  revelacao: 'revelacao_id',
}

/**
 * Pontos a exibir no badge de um palpite de bônus no perfil público.
 * null = resultado oficial daquele tipo ainda não definido → não mostra badge.
 */
export function pontosBonusExibicao(
  tipo: TipoBonus,
  pontosCalculados: number | null,
  oficial: CopaResultadosOficial | null,
): number | null {
  if (!oficial || oficial[CAMPO_OFICIAL[tipo]] == null) return null
  return pontosCalculados ?? 0
}
