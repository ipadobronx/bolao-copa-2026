// lib/dashboard/estado.ts

export type BilheteEstadoInput = {
  id: string
  numero_bilhete: number
  valor_pago: number | null
  effective_status: 'pendente' | 'confirmado' | 'expirado' | 'cancelado'
  created_at: string
}

export type RankingUsuarioInput = {
  melhor_bilhete_id: string
  melhor_numero_bilhete: number
  pontos_totais: number
  posicao: number
  total_bilhetes: number
} | null

export type SnapshotInput = {
  posicao: number
  pontos_totais: number
} | null

export type DeterminarEstadoInput = {
  bilhetes: BilheteEstadoInput[]
  ranking: RankingUsuarioInput
  palpitesCount: number
  jogosFinalizadosCount: number
  copaInicio: Date
  snapshot: SnapshotInput
  totalParticipantes: number
}

export type PendenteInfo = {
  bilhete_id: string
  numero_bilhete: number
  valor_total_pendente: number
  qtd_pendentes: number
}

export type ProgressoInfo = {
  preenchidos: number
  total: number
  porcentagem: number
  totalBilhetes: number
}

export type RankingUsuarioInfo = {
  melhor_bilhete_id: string
  melhor_numero_bilhete: number
  pontos_totais: number
  posicao: number
  total_bilhetes: number
}

export type DashboardEstado =
  | { kind: 'sem-bilhete' }
  | { kind: 'pendente-puro'; pendente: PendenteInfo }
  | { kind: 'pre-copa'; pendente: PendenteInfo | null; copaInicio: Date; progresso: ProgressoInfo }
  | {
      kind: 'em-andamento'
      pendente: PendenteInfo | null
      rankingUsuario: RankingUsuarioInfo
      progresso: ProgressoInfo
      tendenciaPontos: number | null
      tendenciaPosicao: number | null
      totalParticipantes: number
    }

export function determinarEstadoDashboard(input: DeterminarEstadoInput): DashboardEstado {
  const confirmados = input.bilhetes.filter((b) => b.effective_status === 'confirmado')
  const pendentesArr = input.bilhetes.filter((b) => b.effective_status === 'pendente')

  const tem_confirmado = confirmados.length > 0
  const tem_pendente = pendentesArr.length > 0
  const copa_comecou = input.jogosFinalizadosCount > 0

  // Estado A
  if (!tem_confirmado && !tem_pendente) {
    return { kind: 'sem-bilhete' }
  }

  // Calcula pendente (alvo = mais recente; soma valor_pago de todos)
  const pendente: PendenteInfo | null =
    pendentesArr.length === 0
      ? null
      : (() => {
          const sorted = [...pendentesArr].sort(
            (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
          )
          const alvo = sorted[0]!
          return {
            bilhete_id: alvo.id,
            numero_bilhete: alvo.numero_bilhete,
            valor_total_pendente: pendentesArr.reduce((s, b) => s + (b.valor_pago ?? 0), 0),
            qtd_pendentes: pendentesArr.length,
          }
        })()

  // Estado B — pendente puro
  if (!tem_confirmado) {
    // pendente é definitivamente !== null aqui (porque tem_pendente && !tem_confirmado)
    return { kind: 'pendente-puro', pendente: pendente! }
  }

  // Calcula progresso (apenas confirmados contam)
  const total = confirmados.length * 104
  const progresso: ProgressoInfo = {
    preenchidos: input.palpitesCount,
    total,
    porcentagem: total === 0 ? 0 : Math.round((input.palpitesCount / total) * 100),
    totalBilhetes: confirmados.length,
  }

  // Estado C — pre-copa
  // Edge graceful: se ranking_usuarios vazio (race), degrada pra pre-copa.
  if (!copa_comecou || input.ranking === null) {
    return {
      kind: 'pre-copa',
      pendente,
      copaInicio: input.copaInicio,
      progresso,
    }
  }

  // Estado D — em-andamento
  const tendenciaPontos = input.snapshot ? input.ranking.pontos_totais - input.snapshot.pontos_totais : null
  // Posição menor = melhor → invertida: positivo significa "subiu" (foi de #50 pra #42 = +8)
  const tendenciaPosicao = input.snapshot ? input.snapshot.posicao - input.ranking.posicao : null

  return {
    kind: 'em-andamento',
    pendente,
    rankingUsuario: input.ranking,
    progresso,
    tendenciaPontos,
    tendenciaPosicao,
    totalParticipantes: input.totalParticipantes,
  }
}
