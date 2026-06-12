import Link from 'next/link'
import { PodioSection } from './PodioSection'
import { RankingTable } from './RankingTable'
import type { RankingRowData } from './RankingRow'
import type { PodioEntry } from './PodioSection'

export function RankingTabGeral({
  rows,
  onAbrirPerfil,
}: {
  rows: RankingRowData[]
  onAbrirPerfil?: (d: RankingRowData) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="ranking-empty">
        <span aria-hidden="true" className="ranking-empty-icon">🏆</span>
        <p className="ranking-empty-title">O ranking ainda está vazio</p>
        <p className="ranking-empty-sub">
          Seja o primeiro a comprar sua tabela e garantir sua posição.
        </p>
        <Link href="/comprar" className="btn-primary">Comprar tabela →</Link>
      </div>
    )
  }

  const top3: PodioEntry[] = rows
    .filter((r) => r.posicao <= 3)
    .map((r) => ({
      userId: r.userId,
      nome: r.nome,
      posicao: r.posicao,
      pontosTotais: r.pontosTotais,
      totalBilhetes: r.totalBilhetes,
      isCurrentUser: r.isCurrentUser,
      clube: r.clube ?? null,
    }))

  return (
    <>
      <PodioSection entries={top3} />
      <RankingTable rows={rows} {...(onAbrirPerfil ? { onAbrirPerfil } : {})} />
    </>
  )
}
