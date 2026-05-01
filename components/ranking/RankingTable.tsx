import { RankingRow, type RankingRowData } from './RankingRow'

export function RankingTable({ rows }: { rows: RankingRowData[] }) {
  return (
    <div className="ranking-table-panel">
      <table className="ranking-table" role="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Apostador</th>
            <th>Acertos</th>
            <th>Tend.</th>
            <th>Pontos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RankingRow key={row.userId} data={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
