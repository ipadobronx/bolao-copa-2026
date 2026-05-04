'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import type { SelecaoBasica } from './JogoRow'

type CopaResultados = {
  id: number
  campeao_id: number | null
  vice_id: number | null
  terceiro_id: number | null
  quarto_id: number | null
  artilheiro_nome: string | null
  revelacao_id: number | null
  finalizada: boolean
}

type Props = {
  copaResultados: CopaResultados
  selecoes: SelecaoBasica[]
}

type BonusCampo =
  | { label: string; key: 'campeao_id' | 'vice_id' | 'terceiro_id' | 'quarto_id' | 'revelacao_id'; tipo: 'selecao'; obrigatorio: boolean }
  | { label: string; key: 'artilheiro_nome'; tipo: 'texto'; obrigatorio: boolean }

const CAMPOS: BonusCampo[] = [
  { label: 'Campeão',    key: 'campeao_id',      tipo: 'selecao', obrigatorio: true  },
  { label: 'Vice',       key: 'vice_id',          tipo: 'selecao', obrigatorio: true  },
  { label: '3º lugar',   key: 'terceiro_id',      tipo: 'selecao', obrigatorio: true  },
  { label: '4º lugar',   key: 'quarto_id',        tipo: 'selecao', obrigatorio: true  },
  { label: 'Artilheiro', key: 'artilheiro_nome',  tipo: 'texto',   obrigatorio: true  },
  { label: 'Revelação',  key: 'revelacao_id',     tipo: 'selecao', obrigatorio: false },
]

export function BonusForm({ copaResultados: initial, selecoes }: Props) {
  const [copa, setCopa] = useState<CopaResultados>(initial)
  const [loadingCampo, setLoadingCampo] = useState<string | null>(null)
  const [loadingRecalcular, setLoadingRecalcular] = useState(false)
  const [loadingFinalizar, setLoadingFinalizar] = useState(false)

  const obrigatoriosPreenchidos =
    copa.campeao_id !== null &&
    copa.vice_id !== null &&
    copa.terceiro_id !== null &&
    copa.quarto_id !== null &&
    copa.artilheiro_nome !== null

  async function salvarCampo(campo: BonusCampo, valor: number | string | null) {
    setLoadingCampo(campo.key)
    try {
      const res = await fetch('/api/admin/copa-resultados', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo.key]: valor }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setCopa((prev) => ({ ...prev, [campo.key]: valor }))
      toast.success(`${campo.label} salvo — ${data.total_bonus_recalculados} bilhetes recalculados`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setLoadingCampo(null)
    }
  }

  async function handleRecalcularTodos() {
    setLoadingRecalcular(true)
    try {
      const res = await fetch('/api/admin/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'bonus' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro')
      toast.success(`Bônus recalculados — ${data.total} bilhetes atualizados`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao recalcular')
    } finally {
      setLoadingRecalcular(false)
    }
  }

  async function handleFinalizar(checked: boolean) {
    setLoadingFinalizar(true)
    try {
      const res = await fetch('/api/admin/copa-resultados', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalizada: checked }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro')
      setCopa((prev) => ({ ...prev, finalizada: checked }))
      toast.success(checked ? 'Copa marcada como finalizada' : 'Copa reaberta')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoadingFinalizar(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="text-text-primary text-sm font-semibold">Resultados finais da Copa</span>
      </div>
      <div className="divide-border divide-y p-4">
        {CAMPOS.map((campo) => {
          const isLoading = loadingCampo === campo.key
          return (
            <div key={campo.key} className="flex items-center gap-3 py-3">
              <label className="text-text-muted w-28 flex-shrink-0 text-sm">
                {campo.label}
                {!campo.obrigatorio && (
                  <span className="text-text-muted ml-1 text-xs">(opcional)</span>
                )}
              </label>
              {campo.tipo === 'selecao' ? (
                <FieldSelecao
                  campo={campo as Extract<BonusCampo, { tipo: 'selecao' }>}
                  copa={copa}
                  selecoes={selecoes}
                  isLoading={isLoading}
                  onSalvar={salvarCampo}
                />
              ) : (
                <FieldTexto
                  campo={campo as Extract<BonusCampo, { tipo: 'texto' }>}
                  copa={copa}
                  isLoading={isLoading}
                  onSalvar={salvarCampo}
                />
              )}
            </div>
          )
        })}

        <div className="flex items-center gap-3 py-3">
          <label className="text-text-muted w-28 flex-shrink-0 text-sm">Copa finalizada</label>
          <input
            type="checkbox"
            checked={copa.finalizada}
            disabled={!obrigatoriosPreenchidos || loadingFinalizar}
            onChange={(e) => handleFinalizar(e.target.checked)}
            className="accent-accent h-4 w-4 disabled:opacity-50"
            title={!obrigatoriosPreenchidos ? 'Preencha todos os campos obrigatórios antes' : undefined}
          />
          {!obrigatoriosPreenchidos && (
            <span className="text-text-muted text-xs">Preencha campeão, vice, 3º, 4º e artilheiro antes</span>
          )}
        </div>

        <div className="pt-3">
          <button
            onClick={handleRecalcularTodos}
            disabled={loadingRecalcular}
            className="btn-sm flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={loadingRecalcular ? 'animate-spin' : ''} />
            {loadingRecalcular ? 'Recalculando…' : 'Recalcular todos os bônus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes de campo ──────────────────────────────────────────────────

function FieldSelecao({
  campo,
  copa,
  selecoes,
  isLoading,
  onSalvar,
}: {
  campo: Extract<BonusCampo, { tipo: 'selecao' }>
  copa: CopaResultados
  selecoes: SelecaoBasica[]
  isLoading: boolean
  onSalvar: (campo: BonusCampo, valor: number | null) => void
}) {
  const [local, setLocal] = useState<number | null>((copa[campo.key] as number | null) ?? null)

  return (
    <>
      <select
        value={local ?? ''}
        onChange={(e) => setLocal(e.target.value ? Number(e.target.value) : null)}
        className="border-border bg-bg-elevated text-text-primary flex-1 rounded border px-2 py-1.5 text-sm"
      >
        <option value="">— não definido —</option>
        {selecoes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.bandeira_emoji} {s.nome}
          </option>
        ))}
      </select>
      <button
        onClick={() => onSalvar(campo, local)}
        disabled={isLoading || local === ((copa[campo.key] as number | null) ?? null)}
        className="btn-sm"
      >
        {isLoading ? '…' : 'Salvar'}
      </button>
    </>
  )
}

function FieldTexto({
  campo,
  copa,
  isLoading,
  onSalvar,
}: {
  campo: Extract<BonusCampo, { tipo: 'texto' }>
  copa: CopaResultados
  isLoading: boolean
  onSalvar: (campo: BonusCampo, valor: string | null) => void
}) {
  const [local, setLocal] = useState<string>((copa[campo.key] as string | null) ?? '')

  return (
    <>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Nome do jogador"
        className="border-border bg-bg-elevated text-text-primary flex-1 rounded border px-2 py-1.5 text-sm"
      />
      <button
        onClick={() => onSalvar(campo, local.trim() || null)}
        disabled={isLoading || local.trim() === ((copa[campo.key] as string | null) ?? '')}
        className="btn-sm"
      >
        {isLoading ? '…' : 'Salvar'}
      </button>
    </>
  )
}
