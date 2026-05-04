'use client'

import { calcularValorCashback } from '@/lib/cashback'
import type { CashbackMultiplicador } from '@/lib/cashback'
import { formatBRL } from '@/lib/format/brl'
import { cn } from '@/lib/utils'

type Bilhete = {
  id: string
  numero_bilhete: number
  valor_pago: number
  cashback_multiplicador_snapshot: number
  cashback_pago: boolean
  cashback_pago_em: string | null
  apostador_nome: string
  pago_por_nome: string | null
}

type Props = {
  bilhete: Bilhete
  copaFinalizada: boolean
  ehCampea: boolean
  selected: boolean
  loading: boolean
  onToggle: (id: string) => void
  onMarcar: (id: string) => void
}

export function ApostadorCashbackRow({
  bilhete: b,
  copaFinalizada,
  ehCampea,
  selected,
  loading,
  onToggle,
  onMarcar,
}: Props) {
  const valorCashback = calcularValorCashback(
    b.valor_pago,
    b.cashback_multiplicador_snapshot as CashbackMultiplicador,
  )
  const esmaecida = copaFinalizada && !ehCampea

  const dataPago = b.cashback_pago_em
    ? new Date(b.cashback_pago_em).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      })
    : null

  // Checkbox visível quando: não pago E não (finalizada E seleção não-campeã)
  const showCheckbox = !b.cashback_pago && !(copaFinalizada && !ehCampea)

  const tooltipBtn = !copaFinalizada
    ? 'Copa não finalizada'
    : !ehCampea
      ? 'Seleção não foi campeã'
      : undefined

  return (
    <div
      className={cn(
        'border-border flex items-center gap-3 border-b px-4 py-3 text-sm last:border-0',
        esmaecida && 'opacity-50',
      )}
    >
      {showCheckbox ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(b.id)}
          className="accent-accent size-4 cursor-pointer"
          aria-label={`Selecionar bilhete #${b.numero_bilhete}`}
        />
      ) : (
        <div className="size-4 shrink-0" />
      )}

      <span className="text-text-muted w-10 shrink-0 font-mono text-xs">
        #{b.numero_bilhete}
      </span>

      <span className="text-text-primary min-w-0 flex-1 truncate">{b.apostador_nome}</span>

      <span className="text-text-muted shrink-0 font-mono text-xs">
        {formatBRL(b.valor_pago)}{' '}
        <span className="text-text-muted">→</span>{' '}
        <span className="text-accent font-semibold">{formatBRL(valorCashback)}</span>
      </span>

      {b.cashback_pago ? (
        <span
          className="text-success shrink-0 font-mono text-xs"
          title={b.pago_por_nome ? `Pago por ${b.pago_por_nome}` : undefined}
        >
          ✓ Pago {dataPago}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onMarcar(b.id)}
          disabled={!copaFinalizada || !ehCampea || loading}
          title={tooltipBtn}
          className="btn-sm shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? '...' : 'Marcar pago'}
        </button>
      )}
    </div>
  )
}
