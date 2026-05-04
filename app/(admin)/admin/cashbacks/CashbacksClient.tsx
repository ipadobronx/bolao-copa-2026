'use client'

import { useState } from 'react'
import { KpiCard } from '@/components/admin/KpiCard'
import { SelecaoCashbackRow } from '@/components/admin/SelecaoCashbackRow'
import { formatBRL } from '@/lib/format/brl'

type Kpis = {
  exposicao_total: number
  pior_cenario_selecao: string
  pior_cenario_valor: number
  bilhetes_elegiveis: number
  a_pagar_agora: number | null
}

type Bilhete = {
  id: string
  numero_bilhete: number
  valor_pago: number
  cashback_multiplicador_snapshot: number
  cashback_pago: boolean
  cashback_pago_em: string | null
  selecao_cashback_id: number | null
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
  kpis: Kpis
  bilhetes: Bilhete[]
  selecoes: Selecao[]
  copaResultados: { finalizada: boolean; campeao_id: number | null }
}

export function CashbacksClient({
  kpis,
  bilhetes: initialBilhetes,
  selecoes,
  copaResultados,
}: Props) {
  const [bilhetes, setBilhetes] = useState(initialBilhetes)

  function handleBilhetesUpdate(ids: string[], pago_em: string) {
    setBilhetes((prev) =>
      prev.map((b) =>
        ids.includes(b.id) ? { ...b, cashback_pago: true, cashback_pago_em: pago_em } : b,
      ),
    )
  }

  const aPagarLabel =
    copaResultados.finalizada && kpis.a_pagar_agora !== null
      ? String(kpis.a_pagar_agora)
      : '—'

  return (
    <>
      {/* KPI cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Exposição total"
          value={formatBRL(Number(kpis.exposicao_total))}
          icon="💸"
          colorClass="red"
        />
        <KpiCard
          label="Pior cenário"
          value={`${kpis.pior_cenario_selecao} · ${formatBRL(Number(kpis.pior_cenario_valor))}`}
          icon="⚠️"
          colorClass="yellow"
        />
        <KpiCard
          label="Bilhetes elegíveis"
          value={String(kpis.bilhetes_elegiveis)}
          icon="🎫"
          colorClass="blue"
        />
        <KpiCard
          label="A pagar agora"
          value={aPagarLabel}
          icon="💚"
          colorClass="green"
        />
      </div>

      {/* Lista das seleções */}
      <div>
        <p className="text-text-muted mb-4 font-mono text-xs uppercase tracking-wider">
          Seleções elegíveis ({selecoes.length})
        </p>
        {selecoes.map((sel) => (
          <SelecaoCashbackRow
            key={sel.id}
            selecao={sel}
            bilhetes={bilhetes.filter((b) => b.selecao_cashback_id === sel.id)}
            copaFinalizada={copaResultados.finalizada}
            campeaoId={copaResultados.campeao_id}
            onBilhetesUpdate={handleBilhetesUpdate}
          />
        ))}
      </div>
    </>
  )
}
