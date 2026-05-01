import type { FaseJogo } from './pontuacao'

export type JogoParaPeriodo = {
  id: number
  fase: FaseJogo
  data_hora: string
  finalizado: boolean
}

export type PeriodoAtual = {
  label: string
  periodoKey: string
  jogoIds: number[]
}

const LABEL_FASE: Record<FaseJogo, string> = {
  grupos: 'Fase de Grupos',
  '16avos': '16avos de final',
  oitavas: 'Oitavas de final',
  quartas: 'Quartas de final',
  semis: 'Semifinais',
  disputa_terceiro: 'Disputa de 3° lugar',
  final: 'Final',
}

export function determinarPeriodoAtual(jogos: JogoParaPeriodo[]): PeriodoAtual | null {
  if (jogos.length === 0) return null

  // Fase ativa = fase do próximo jogo não finalizado; fallback: fase do último finalizado
  const proximos = jogos
    .filter((j) => !j.finalizado)
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())

  const finalizados = jogos
    .filter((j) => j.finalizado)
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())

  const faseAtiva: FaseJogo = (proximos[0]?.fase ?? finalizados[0]?.fase ?? 'grupos') as FaseJogo

  if (faseAtiva !== 'grupos') {
    const jogosDaFase = jogos.filter((j) => j.fase === faseAtiva)
    return {
      label: LABEL_FASE[faseAtiva],
      periodoKey: faseAtiva,
      jogoIds: jogosDaFase.map((j) => j.id),
    }
  }

  // Grupos: dividir em 3 rodadas pelo índice cronológico
  // Rodada 1 = primeiros 1/3 dos jogos de grupos
  // Rodada 2 = próximos 1/3
  // Rodada 3 = últimos 1/3
  const jogosGrupos = jogos
    .filter((j) => j.fase === 'grupos')
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())

  const total = jogosGrupos.length
  const rodadaSize = Math.ceil(total / 3)

  // Rodada ativa = a que contém o último jogo finalizado, ou r1 se nenhum
  const ultimoFinalizado = jogosGrupos.filter((j) => j.finalizado).at(-1)
  const idxUltimo = ultimoFinalizado
    ? jogosGrupos.findIndex((j) => j.id === ultimoFinalizado.id)
    : -1

  const rodadaIdx = idxUltimo < 0 ? 0 : Math.min(Math.floor(idxUltimo / rodadaSize), 2)
  const rodadaNum = rodadaIdx + 1
  const slice = jogosGrupos.slice(rodadaIdx * rodadaSize, (rodadaIdx + 1) * rodadaSize)

  return {
    label: `Grupos — Rodada ${rodadaNum}`,
    periodoKey: `grupos_r${rodadaNum}`,
    jogoIds: slice.map((j) => j.id),
  }
}
