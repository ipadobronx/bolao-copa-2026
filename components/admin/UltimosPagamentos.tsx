import { tempoAtras } from '@/lib/format/tempo-atras'

export type PagamentoRow = {
  id: string
  numero_bilhete: number
  valor_pago: number
  status_pagamento: string
  pago_em: string | null
  created_at: string
  nome: string
  bandeira_emoji: string | null
  selecao_nome: string | null
  total_bilhetes_usuario: number
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  confirmado: { label: 'Confirmado', className: 'bg-success/15 text-success' },
  pendente:   { label: 'Aguardando', className: 'bg-accent/15 text-accent' },
  expirado:   { label: 'Expirado',   className: 'bg-white/10 text-text-muted' },
  cancelado:  { label: 'Cancelado',  className: 'bg-danger/15 text-danger' },
}

export function UltimosPagamentos({ rows, agora }: { rows: PagamentoRow[]; agora: Date }) {
  if (rows.length === 0) {
    return (
      <p className="text-text-muted px-6 py-8 text-center text-sm">
        Nenhum pagamento registrado ainda.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b text-left">
            <th className="text-text-muted px-6 py-3 font-mono text-xs font-medium uppercase tracking-wide">
              Apostador
            </th>
            <th className="text-text-muted px-4 py-3 font-mono text-xs font-medium uppercase tracking-wide">
              Valor
            </th>
            <th className="text-text-muted px-4 py-3 font-mono text-xs font-medium uppercase tracking-wide">
              Status
            </th>
            <th className="text-text-muted px-4 py-3 font-mono text-xs font-medium uppercase tracking-wide">
              Quando
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const statusKey = row.status_pagamento as keyof typeof STATUS_LABEL
            const status = STATUS_LABEL[statusKey] ?? STATUS_LABEL.pendente as typeof STATUS_LABEL[keyof typeof STATUS_LABEL]
            const timestamp = row.pago_em ?? row.created_at
            const cashbackInfo = row.bandeira_emoji
              ? `${row.bandeira_emoji} ${row.selecao_nome}`
              : null

            return (
              <tr
                key={row.id}
                className="border-border hover:bg-bg-elevated/50 border-b last:border-0 transition-colors"
              >
                <td className="px-6 py-3">
                  <div className="font-medium">{row.nome}</div>
                  <div className="text-text-muted font-mono text-[11px]">
                    {row.total_bilhetes_usuario}{' '}
                    {row.total_bilhetes_usuario === 1 ? 'tabela' : 'tabelas'}
                    {cashbackInfo ? ` · cashback ${cashbackInfo}` : ''}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono font-semibold">
                  R$ {row.valor_pago.toFixed(2).replace('.', ',')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="text-text-muted px-4 py-3 font-mono text-xs">
                  {tempoAtras(timestamp, agora)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
