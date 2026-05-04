'use client'

import { useState } from 'react'
import { toast } from 'sonner'

const PERIODOS = [
  { value: 'grupos_r1',        label: 'Grupos — Rodada 1' },
  { value: 'grupos_r2',        label: 'Grupos — Rodada 2' },
  { value: 'grupos_r3',        label: 'Grupos — Rodada 3' },
  { value: '16avos',           label: '16avos de final' },
  { value: 'oitavas',          label: 'Oitavas de final' },
  { value: 'quartas',          label: 'Quartas de final' },
  { value: 'semis',            label: 'Semifinais' },
  { value: 'disputa_terceiro', label: 'Disputa de 3° lugar' },
  { value: 'final',            label: 'Final' },
]

async function postSnapshot(periodo: string, force: boolean) {
  const res = await fetch('/api/admin/ranking-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodo, force }),
  })
  let data: unknown = null
  try { data = await res.json() } catch { /* non-JSON body */ }
  return { status: res.status, data }
}

export function SnapshotRanking() {
  const [periodo, setPeriodo] = useState('grupos_r1')
  const [loading, setLoading] = useState(false)
  const [pendingOverwrite, setPendingOverwrite] = useState<string | null>(null)

  async function handleSnapshot(force = false) {
    setLoading(true)
    try {
      const { status, data } = await postSnapshot(periodo, force)
      if (status === 409) {
        setPendingOverwrite(periodo)
        return
      }
      if (status !== 200) {
        const msg = typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : 'Erro desconhecido'
        toast.error(`Erro ao tirar snapshot: ${msg}`)
        return
      }
      const count = typeof data === 'object' && data !== null && 'count' in data
        ? (data as { count: number }).count
        : '?'
      toast.success(`Snapshot salvo — ${count} apostadores registrados`)
      setPendingOverwrite(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-text-primary text-sm font-semibold">Tirar snapshot do ranking</h3>
        <p className="text-text-muted mt-0.5 text-xs">
          Salva as posições atuais para calcular tendência (▲/▼) na próxima rodada.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={periodo}
          onChange={(e) => { setPeriodo(e.target.value); setPendingOverwrite(null) }}
          disabled={loading}
          className="border-border bg-bg-elevated text-text-primary rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => handleSnapshot(false)}
          disabled={loading || !!pendingOverwrite}
          className="btn-sm"
        >
          {loading ? 'Salvando…' : 'Tirar snapshot'}
        </button>
      </div>

      {/* Dialog de confirmação de sobrescrita */}
      {pendingOverwrite && (
        <div className="border-border bg-bg-elevated mt-4 rounded-lg border p-4">
          <p className="text-text-primary mb-3 text-sm font-medium">
            Já existe um snapshot para <span className="text-accent font-mono">{PERIODOS.find(p => p.value === pendingOverwrite)?.label ?? pendingOverwrite}</span>.
            Sobrescrever?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSnapshot(true)}
              disabled={loading}
              className="bg-danger/10 text-danger hover:bg-danger/20 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            >
              {loading ? 'Sobrescrevendo…' : 'Sim, sobrescrever'}
            </button>
            <button
              type="button"
              onClick={() => setPendingOverwrite(null)}
              disabled={loading}
              className="btn-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
