'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { exposicaoSelecao } from '@/lib/cashback-pagamento'
import { formatBRL } from '@/lib/format/brl'
import { ApostadorCashbackRow } from './ApostadorCashbackRow'

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

type Selecao = {
  id: number
  nome: string
  codigo_iso: string
  cashback_multiplicador: number
}

type Props = {
  selecao: Selecao
  bilhetes: Bilhete[]
  copaFinalizada: boolean
  campeaoId: number | null
  onBilhetesUpdate: (ids: string[], pago_em: string) => void
}

export function SelecaoCashbackRow({
  selecao,
  bilhetes,
  copaFinalizada,
  campeaoId,
  onBilhetesUpdate,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  const ehCampea = selecao.id === campeaoId
  const { total, count } = exposicaoSelecao(bilhetes)

  async function marcar(ids: string[]) {
    setLoadingIds(new Set(ids))
    try {
      const res = await fetch('/api/admin/cashbacks/marcar-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bilheteIds: ids }),
      })
      const data = (await res.json()) as {
        marcados?: number
        ja_estavam_pagos?: number
        total_solicitados?: number
        error?: string
      }
      if (!res.ok) {
        toast.error(`Erro: ${data.error ?? 'Falha ao marcar'}`)
        return
      }
      const { marcados = 0, ja_estavam_pagos = 0 } = data
      if (marcados > 0 && ja_estavam_pagos === 0) {
        toast.success(
          `${marcados} cashback${marcados > 1 ? 's' : ''} marcado${marcados > 1 ? 's' : ''} como pago${marcados > 1 ? 's' : ''}`,
        )
      } else if (marcados > 0) {
        toast.success(`${marcados} marcados · ${ja_estavam_pagos} já estavam pagos`)
      } else {
        toast.info(`Todos os ${ja_estavam_pagos} já estavam pagos`)
      }
      const agora = new Date().toISOString()
      onBilhetesUpdate(ids, agora)
      setSelected(new Set())
    } finally {
      setLoadingIds(new Set())
    }
  }

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const pendentes = bilhetes.filter((b) => !b.cashback_pago)
  const allPendentesSelected =
    pendentes.length > 0 && pendentes.every((b) => selected.has(b.id))

  const toggleAll = () => {
    setSelected(allPendentesSelected ? new Set() : new Set(pendentes.map((b) => b.id)))
  }

  const showBulkControls = pendentes.length > 0 && !(copaFinalizada && !ehCampea)

  return (
    <div className="panel mb-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="text-text-muted size-4 shrink-0" />
        ) : (
          <ChevronRight className="text-text-muted size-4 shrink-0" />
        )}
        <img
          src={`https://flagcdn.com/24x18/${selecao.codigo_iso.toLowerCase()}.png`}
          alt={selecao.nome}
          className="h-4"
          width={24}
          height={18}
        />
        <span className="text-text-primary font-semibold">{selecao.nome}</span>
        <span className="text-accent font-mono text-xs">{selecao.cashback_multiplicador}×</span>
        <span className="text-text-muted text-xs">
          {count} bilhete{count !== 1 ? 's' : ''}
        </span>
        <span className="text-danger ml-auto font-mono text-xs font-semibold">
          {formatBRL(total)}
        </span>
      </button>

      {expanded && (
        <div className="border-border border-t">
          {showBulkControls && (
            <div className="border-border flex items-center gap-3 border-b bg-white/5 px-4 py-2">
              <input
                type="checkbox"
                checked={allPendentesSelected}
                onChange={toggleAll}
                className="accent-accent size-4"
                aria-label="Selecionar todos pendentes"
              />
              <span className="text-text-muted text-xs">Selecionar todos</span>
              <button
                type="button"
                onClick={() => marcar([...selected])}
                disabled={selected.size === 0 || loadingIds.size > 0}
                className="btn-sm ml-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Marcar selecionados ({selected.size})
              </button>
            </div>
          )}

          {bilhetes.length === 0 ? (
            <p className="text-text-muted px-4 py-3 text-sm">Nenhum bilhete elegível.</p>
          ) : (
            bilhetes.map((b) => (
              <ApostadorCashbackRow
                key={b.id}
                bilhete={b}
                copaFinalizada={copaFinalizada}
                ehCampea={ehCampea}
                selected={selected.has(b.id)}
                loading={loadingIds.has(b.id)}
                onToggle={toggleSelect}
                onMarcar={(id) => marcar([id])}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
