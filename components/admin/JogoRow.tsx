'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { PlaceholderSelect } from './PlaceholderSelect'
import { BandeiraImg } from '@/components/ui/BandeiraImg'

export type SelecaoBasica = {
  id: number
  nome: string
  bandeira_emoji: string
  codigo_iso: string
}

export type JogoComSelecoes = {
  id: number
  numero_jogo: number
  fase: string
  data_hora: string
  selecao_casa_id: number | null
  selecao_fora_id: number | null
  placeholder_casa: string | null
  placeholder_fora: string | null
  gols_casa: number | null
  gols_fora: number | null
  finalizado: boolean
  selecao_casa: SelecaoBasica | null
  selecao_fora: SelecaoBasica | null
}

type Props = {
  jogo: JogoComSelecoes
  selecoes: SelecaoBasica[]
  jogoByNumero: Map<number, JogoComSelecoes>
  onAtualizado: (jogoAtualizado: JogoComSelecoes) => void
}

const FASES_MATA_MATA = ['16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final']

function formatDataHora(iso: string) {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')} · ${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
}

function extrairNumeroJogo(placeholder: string | null): number | null {
  if (!placeholder) return null
  const match = placeholder.match(/\d+/)
  return match ? Number(match[0]) : null
}

export function JogoRow({ jogo, selecoes, jogoByNumero, onAtualizado }: Props) {
  const [golsCasa, setGolsCasa] = useState(jogo.gols_casa?.toString() ?? '')
  const [golsFora, setGolsFora] = useState(jogo.gols_fora?.toString() ?? '')
  const [selecaoCasaId, setSelecaoCasaId] = useState<number | null>(jogo.selecao_casa_id)
  const [selecaoForaId, setSelecaoForaId] = useState<number | null>(jogo.selecao_fora_id)
  const [loadingFinalizar, setLoadingFinalizar] = useState(false)
  const [loadingRecalcular, setLoadingRecalcular] = useState(false)
  const [loadingSelecoes, setLoadingSelecoes] = useState(false)

  const isMataMatata = FASES_MATA_MATA.includes(jogo.fase)
  const placeholderCasaPendente = isMataMatata && jogo.selecao_casa_id === null
  const placeholderForaPendente = isMataMatata && jogo.selecao_fora_id === null
  const temPlaceholderPendente = placeholderCasaPendente || placeholderForaPendente

  const golsCasaNum = golsCasa === '' ? null : Number(golsCasa)
  const golsForaNum = golsFora === '' ? null : Number(golsFora)
  const podeFinalizarGols =
    golsCasaNum !== null && !isNaN(golsCasaNum) && golsCasaNum >= 0 &&
    golsForaNum !== null && !isNaN(golsForaNum) && golsForaNum >= 0
  const podeFinalizarSelecoes = !isMataMatata || (selecaoCasaId !== null && selecaoForaId !== null)
  const podeFinalizar = podeFinalizarGols && podeFinalizarSelecoes && !temPlaceholderPendente

  function sugerirVencedor(placeholder: string | null): { selecaoId: number | null; tooltip: string } {
    const num = extrairNumeroJogo(placeholder)
    if (!num) return { selecaoId: null, tooltip: 'Placeholder inválido' }
    const ref = jogoByNumero.get(num)
    if (!ref) return { selecaoId: null, tooltip: `Jogo ${num} não encontrado` }
    if (!ref.finalizado) return { selecaoId: null, tooltip: `Jogo ${num} ainda não finalizado` }
    if (ref.gols_casa === null || ref.gols_fora === null) {
      return { selecaoId: null, tooltip: `Jogo ${num} sem placar` }
    }
    if (ref.gols_casa > ref.gols_fora) {
      return { selecaoId: ref.selecao_casa_id, tooltip: `Vencedor Jogo ${num}` }
    }
    if (ref.gols_fora > ref.gols_casa) {
      return { selecaoId: ref.selecao_fora_id, tooltip: `Vencedor Jogo ${num}` }
    }
    return { selecaoId: null, tooltip: `Jogo ${num} empatado (pênaltis) — define manualmente` }
  }

  async function handleSalvarSelecoes() {
    setLoadingSelecoes(true)
    try {
      const res = await fetch(`/api/admin/jogos/${jogo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selecao_casa_id: selecaoCasaId, selecao_fora_id: selecaoForaId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao salvar')
      }
      const selCasa = selecoes.find((s) => s.id === selecaoCasaId) ?? null
      const selFora = selecoes.find((s) => s.id === selecaoForaId) ?? null
      onAtualizado({ ...jogo, selecao_casa_id: selecaoCasaId, selecao_fora_id: selecaoForaId, selecao_casa: selCasa, selecao_fora: selFora })
      toast.success('Seleções salvas')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar seleções')
    } finally {
      setLoadingSelecoes(false)
    }
  }

  async function handleFinalizar() {
    if (!podeFinalizar) return
    setLoadingFinalizar(true)
    try {
      const res = await fetch('/api/admin/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'jogo', jogoId: jogo.id, gols_casa: golsCasaNum, gols_fora: golsForaNum }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao finalizar')
      toast.success(`Jogo #${jogo.numero_jogo} finalizado — ${data.total} palpites recalculados`)
      onAtualizado({ ...jogo, gols_casa: golsCasaNum, gols_fora: golsForaNum, finalizado: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao finalizar jogo')
    } finally {
      setLoadingFinalizar(false)
    }
  }

  async function handleRecalcular() {
    setLoadingRecalcular(true)
    try {
      const res = await fetch('/api/admin/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'jogo', jogoId: jogo.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao recalcular')
      toast.success(`Jogo #${jogo.numero_jogo} — ${data.total} palpites recalculados`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao recalcular')
    } finally {
      setLoadingRecalcular(false)
    }
  }

  const nomeCasa = jogo.selecao_casa?.nome ?? jogo.placeholder_casa ?? '?'
  const nomeForaa = jogo.selecao_fora?.nome ?? jogo.placeholder_fora ?? '?'

  return (
    <div className="border-border grid grid-cols-[auto_1fr_auto_1fr_auto_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 md:gap-4">
      {/* Jogo + data */}
      <div className="font-mono text-text-muted min-w-[90px] text-xs">
        <div className="text-text-primary font-semibold">#{jogo.numero_jogo}</div>
        <div>{formatDataHora(jogo.data_hora)}</div>
      </div>

      {/* Time casa */}
      <div className="flex items-center gap-1.5 text-sm">
        {placeholderCasaPendente ? (
          <PlaceholderSelect
            value={selecaoCasaId}
            onChange={setSelecaoCasaId}
            selecoes={selecoes}
            placeholder={jogo.placeholder_casa ?? 'Casa'}
            className="w-full max-w-[160px]"
          />
        ) : (
          <span className="flex items-center gap-1.5">
            <BandeiraImg emoji={jogo.selecao_casa?.bandeira_emoji ?? null} nome={nomeCasa} size={20} />
            {nomeCasa}
          </span>
        )}
        {placeholderCasaPendente && (() => {
          const sug = sugerirVencedor(jogo.placeholder_casa)
          return (
            <button
              onClick={() => sug.selecaoId && setSelecaoCasaId(sug.selecaoId)}
              disabled={!sug.selecaoId}
              title={sug.tooltip}
              className="text-accent disabled:text-text-muted text-xs underline disabled:no-underline"
            >
              Sugerir
            </button>
          )
        })()}
      </div>

      {/* Placar */}
      <div className="flex items-center gap-1">
        {jogo.finalizado ? (
          <span className="font-mono text-text-primary text-sm">
            {jogo.gols_casa} × {jogo.gols_fora}
          </span>
        ) : (
          <>
            <input
              type="number"
              min={0}
              max={30}
              value={golsCasa}
              onChange={(e) => setGolsCasa(e.target.value)}
              disabled={temPlaceholderPendente}
              className="border-border bg-bg-elevated font-mono text-text-primary w-10 rounded border p-1 text-center text-sm disabled:opacity-40"
              placeholder="–"
            />
            <span className="text-text-muted text-sm">×</span>
            <input
              type="number"
              min={0}
              max={30}
              value={golsFora}
              onChange={(e) => setGolsFora(e.target.value)}
              disabled={temPlaceholderPendente}
              className="border-border bg-bg-elevated font-mono text-text-primary w-10 rounded border p-1 text-center text-sm disabled:opacity-40"
              placeholder="–"
            />
          </>
        )}
      </div>

      {/* Time fora */}
      <div className="flex items-center justify-end gap-1.5 text-sm">
        {placeholderForaPendente ? (
          <>
            {(() => {
              const sug = sugerirVencedor(jogo.placeholder_fora)
              return (
                <button
                  onClick={() => sug.selecaoId && setSelecaoForaId(sug.selecaoId)}
                  disabled={!sug.selecaoId}
                  title={sug.tooltip}
                  className="text-accent disabled:text-text-muted text-xs underline disabled:no-underline"
                >
                  Sugerir
                </button>
              )
            })()}
            <PlaceholderSelect
              value={selecaoForaId}
              onChange={setSelecaoForaId}
              selecoes={selecoes}
              placeholder={jogo.placeholder_fora ?? 'Fora'}
              className="w-full max-w-[160px]"
            />
          </>
        ) : (
          <span className="flex items-center justify-end gap-1.5">
            {nomeForaa}
            <BandeiraImg emoji={jogo.selecao_fora?.bandeira_emoji ?? null} nome={nomeForaa} size={20} />
          </span>
        )}
      </div>

      {/* Status pill */}
      <div>
        {jogo.finalizado ? (
          <span className="pill success text-xs">Finalizado</span>
        ) : temPlaceholderPendente ? (
          <span className="pill warning text-xs">Placeholder pendente</span>
        ) : (
          <span className="pill text-xs">Pendente</span>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2">
        {temPlaceholderPendente && (
          <button
            onClick={handleSalvarSelecoes}
            disabled={loadingSelecoes || (selecaoCasaId === null && selecaoForaId === null)}
            className="btn-sm"
          >
            {loadingSelecoes ? '…' : 'Salvar seleções'}
          </button>
        )}
        {!jogo.finalizado && !temPlaceholderPendente && (
          <button
            onClick={handleFinalizar}
            disabled={!podeFinalizar || loadingFinalizar}
            className="btn-sm"
            title={!podeFinalizar ? 'Preencha o placar' : undefined}
          >
            {loadingFinalizar ? '…' : 'Marcar finalizado'}
          </button>
        )}
        {jogo.finalizado && (
          <button
            onClick={handleRecalcular}
            disabled={loadingRecalcular}
            className="btn-sm flex items-center gap-1"
            title="Recalcular pontos deste jogo"
          >
            <RefreshCw size={12} className={loadingRecalcular ? 'animate-spin' : ''} />
            {loadingRecalcular ? '…' : 'Recalcular'}
          </button>
        )}
      </div>
    </div>
  )
}
