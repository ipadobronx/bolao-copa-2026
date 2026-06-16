export type PalpiteJogo = {
  numeroJogo: number
  dataHora: string
  casa: string
  fora: string
  bandeiraCasa: string | null
  bandeiraFora: string | null
  palpiteCasa: number | null
  palpiteFora: number | null
  realCasa: number | null
  realFora: number | null
  finalizado: boolean
  pontos: number | null
}

export type GrupoDia = { dia: string; label: string; jogos: PalpiteJogo[] }

const TZ = 'America/Sao_Paulo'

/**
 * Agrupa palpites por dia (BRT). Dias do mais recente pro mais antigo;
 * dentro do dia, jogos por horário decrescente. `dia` = YYYY-MM-DD (BRT),
 * `label` = ex. "dom., 14/06".
 */
export function agruparPorDia(palpites: PalpiteJogo[]): GrupoDia[] {
  const map = new Map<string, PalpiteJogo[]>()
  for (const p of palpites) {
    const dia = new Date(p.dataHora).toLocaleDateString('en-CA', { timeZone: TZ })
    const arr = map.get(dia)
    if (arr) arr.push(p)
    else map.set(dia, [p])
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([dia, jogos]) => ({
      dia,
      label: new Date(jogos[0]!.dataHora).toLocaleDateString('pt-BR', {
        timeZone: TZ,
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }),
      jogos: [...jogos].sort((x, y) =>
        x.dataHora < y.dataHora ? 1 : x.dataHora > y.dataHora ? -1 : 0,
      ),
    }))
}
