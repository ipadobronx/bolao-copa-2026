'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { RankingTabGeral } from './RankingTabGeral'
import { RankingTabRodada } from './RankingTabRodada'
import type { RankingRowData } from './RankingRow'

export type RankingShellProps = {
  initialRows: RankingRowData[]
  periodoLabel: string
  periodoRows: RankingRowData[]
  totalApostadores: number
}

export function RankingShell({
  initialRows,
  periodoLabel,
  periodoRows: initialPeriodoRows,
  totalApostadores,
}: RankingShellProps) {
  const [tab, setTab] = useState<'geral' | 'rodada'>('geral')
  const [rows, setRows] = useState(initialRows)
  const [periodoRows, setPeriodoRows] = useState(initialPeriodoRows)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchRanking = useCallback(async () => {
    const res = await fetch('/api/ranking')
    if (!res.ok) return
    const json = await res.json()
    if (json.geral) setRows(json.geral)
    if (json.periodo) setPeriodoRows(json.periodo)
  }, [])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel('ranking-signal')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ranking_signals' },
        () => {
          clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(fetchRanking, 3000 + Math.random() * 1500)
        },
      )
      .subscribe()
    return () => {
      clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [fetchRanking])

  const apostadorLabel =
    totalApostadores === 1 ? '1 apostador' : `${totalApostadores} apostadores`

  return (
    <div>
      <div className="ranking-shell-header">
        <div>
          <h1 className="dash-greeting">
            Ranking <span>geral</span>
          </h1>
          <p className="dash-subtitle">
            <span className="live-dot" aria-hidden="true" /> Atualizado em tempo real ·{' '}
            {apostadorLabel}
          </p>
        </div>
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'geral'}
            className={`tab ${tab === 'geral' ? 'tab-active' : ''}`}
            onClick={() => setTab('geral')}
          >
            Geral
          </button>
          <button
            role="tab"
            aria-selected={tab === 'rodada'}
            className={`tab ${tab === 'rodada' ? 'tab-active' : ''}`}
            onClick={() => setTab('rodada')}
          >
            Rodada
          </button>
        </div>
      </div>

      {tab === 'geral' ? (
        <RankingTabGeral rows={rows} />
      ) : (
        <RankingTabRodada label={periodoLabel} rows={periodoRows} />
      )}
    </div>
  )
}
