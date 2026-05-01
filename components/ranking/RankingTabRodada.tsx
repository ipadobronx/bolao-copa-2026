import { RankingTable } from './RankingTable'
import type { RankingRowData } from './RankingRow'

export function RankingTabRodada({
  label,
  rows,
}: {
  label: string
  rows: RankingRowData[]
}) {
  return (
    <div>
      <div className="periodo-banner">
        <span className="periodo-banner-label">{label}</span>
      </div>
      {rows.length === 0 ? (
        <p className="ranking-empty-sub">
          Nenhum ponto registrado neste período ainda.
        </p>
      ) : (
        <RankingTable rows={rows} />
      )}
    </div>
  )
}
