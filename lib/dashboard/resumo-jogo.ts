export type Tendencia = { casa: number; empate: number; fora: number }
export type Placar = { gc: number; gf: number; count: number }
export type ResumoPalpites = { total: number; tendencia: Tendencia; topPlacares: Placar[] }

export type PalpitePessoa = {
  userId: string
  nome: string
  gc: number
  gf: number
  pts: number | null
  isLider: boolean
}

export type JogoResumo = {
  numeroJogo: number
  dataHora: string
  casa: string
  fora: string
  bandeiraCasa: string | null
  bandeiraFora: string | null
  finalizado: boolean
  realCasa: number | null
  realFora: number | null
  total: number
  tendencia: Tendencia
  topPlacares: Placar[]
  palpites: PalpitePessoa[] | null // null = jogo não travado (privado)
}

/** Agrega tendência (mandante/empate/visitante) e os 3 placares mais palpitados. */
export function resumoPalpites(
  palpites: { gols_casa: number; gols_fora: number }[],
): ResumoPalpites {
  const tendencia: Tendencia = { casa: 0, empate: 0, fora: 0 }
  const placarMap = new Map<string, Placar>()
  for (const p of palpites) {
    const d = p.gols_casa - p.gols_fora
    if (d > 0) tendencia.casa++
    else if (d < 0) tendencia.fora++
    else tendencia.empate++
    const key = `${p.gols_casa}x${p.gols_fora}`
    const cur = placarMap.get(key)
    if (cur) cur.count++
    else placarMap.set(key, { gc: p.gols_casa, gf: p.gols_fora, count: 1 })
  }
  const topPlacares = [...placarMap.values()]
    .sort((a, b) => b.count - a.count || b.gc - a.gc || b.gf - a.gf)
    .slice(0, 3)
  return { total: palpites.length, tendencia, topPlacares }
}
