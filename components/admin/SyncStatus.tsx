'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Settings } from 'lucide-react'

type UltimoSync = {
  iniciado_em: string
  finalizado_em: string | null
  jogos_atualizados: number
  status: string
} | null

type Props = {
  ultimoSync: UltimoSync
  totalMapeados: number
}

function tempoAtras(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

export function SyncStatus({ ultimoSync, totalMapeados }: Props) {
  const [loadingSync, setLoadingSync] = useState(false)
  const [loadingMap, setLoadingMap] = useState(false)
  const [mapResult, setMapResult] = useState<{ mapeados: number; warnings: unknown[] } | null>(null)

  async function handleSync() {
    setLoadingSync(true)
    try {
      const res = await fetch('/api/admin/sync-jogos-manual', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro no sync'); return }
      toast.success(`Sync concluído — ${data.jogos_atualizados} jogo(s) atualizados`)
    } catch {
      toast.error('Falha na requisição')
    } finally {
      setLoadingSync(false)
    }
  }

  async function handleMapear() {
    setLoadingMap(true)
    try {
      const res = await fetch('/api/admin/mapear-fixtures', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro no mapping'); return }
      setMapResult(data)
      toast.success(`Mapping concluído — ${data.mapeados}/${data.total_api} mapeados`)
    } catch {
      toast.error('Falha na requisição')
    } finally {
      setLoadingMap(false)
    }
  }

  return (
    <div className="border-border bg-bg-elevated mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="text-text-muted text-sm">
        {ultimoSync ? (
          <>
            Último sync:{' '}
            <span className="text-text-primary">
              há {tempoAtras(ultimoSync.finalizado_em ?? ultimoSync.iniciado_em)}
            </span>
            {' — '}
            <span className="text-text-primary">{ultimoSync.jogos_atualizados} jogo(s) atualizados</span>
          </>
        ) : (
          <span>Nenhum sync realizado ainda</span>
        )}
        {' · '}
        <span className="text-text-muted">{totalMapeados}/104 fixtures mapeados</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSync}
          disabled={loadingSync}
          className="border-border bg-bg-base text-text-primary hover:border-accent flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loadingSync ? 'animate-spin' : ''} />
          Sincronizar agora
        </button>

        {totalMapeados < 104 && (
          <button
            onClick={handleMapear}
            disabled={loadingMap}
            className="border-border bg-bg-base text-text-muted hover:text-text-primary flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
          >
            <Settings size={14} />
            Mapear fixtures
          </button>
        )}
      </div>

      {mapResult && (
        <details className="w-full">
          <summary className="text-text-muted cursor-pointer text-xs">
            Resultado do mapping ({mapResult.mapeados} mapeados, {mapResult.warnings.length} warnings)
          </summary>
          <pre className="bg-bg-base mt-2 overflow-x-auto rounded p-2 text-xs">
            {JSON.stringify(mapResult, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
