import { calcularPontosPalpite, calcularPontosBonus } from './pontuacao'
import type { FaseJogo, TipoBonus, CopaResultadosInput } from './pontuacao'

export type PalpiteRow = { id: string; gols_casa: number; gols_fora: number }
export type JogoFinalizado = { fase: FaseJogo; gols_casa: number; gols_fora: number }
export type BonusRow = {
  id: string
  tipo: TipoBonus
  selecao_id?: number | null
  jogador_nome?: string | null
}
export type UpdatePayload = { id: string; pontos_calculados: number }

export function calcularUpdatesPalpites(
  palpites: PalpiteRow[],
  jogo: JogoFinalizado,
): UpdatePayload[] {
  const jogoInput = { fase: jogo.fase, finalizado: true as const, gols_casa: jogo.gols_casa, gols_fora: jogo.gols_fora }
  return palpites.map((p) => ({
    id: p.id,
    pontos_calculados: calcularPontosPalpite(
      { gols_casa: p.gols_casa, gols_fora: p.gols_fora },
      jogoInput,
    ).total,
  }))
}

export function calcularUpdateBonus(
  bonusRows: BonusRow[],
  resultados: CopaResultadosInput,
  filtroTipos?: TipoBonus[],
): UpdatePayload[] {
  const rows =
    filtroTipos !== undefined
      ? bonusRows.filter((b) => filtroTipos.includes(b.tipo))
      : bonusRows

  return rows.map((b) => {
    let pontos = 0
    if (b.tipo === 'artilheiro') {
      if (b.jogador_nome != null) {
        pontos = calcularPontosBonus({ tipo: 'artilheiro', jogador_nome: b.jogador_nome }, resultados).pontos
      }
    } else if (b.selecao_id != null) {
      pontos = calcularPontosBonus({ tipo: b.tipo, selecao_id: b.selecao_id }, resultados).pontos
    }
    return { id: b.id, pontos_calculados: pontos }
  })
}
