'use client'

import { useMemo, useState } from 'react'
import { BonusForm } from '@/components/admin/BonusForm'
import { JogoRow } from '@/components/admin/JogoRow'
import type { JogoComSelecoes, SelecaoBasica } from '@/components/admin/JogoRow'
import { SyncStatus } from '@/components/admin/SyncStatus'

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
  jogos: JogoComSelecoes[]
  selecoes: SelecaoBasica[]
  copaResultados: CopaResultados
  initialTab: string
  ultimoSync: {
    iniciado_em: string
    finalizado_em: string | null
    jogos_atualizados: number
    status: string
  } | null
  totalMapeados: number
}

const TABS = [
  { id: 'grupos',           label: 'Grupos' },
  { id: '16avos',           label: '16avos' },
  { id: 'oitavas',          label: 'Oitavas' },
  { id: 'quartas',          label: 'Quartas' },
  { id: 'semis',            label: 'Semis' },
  { id: 'disputa_terceiro', label: 'Disputa 3º' },
  { id: 'final',            label: 'Final' },
  { id: 'bonus',            label: 'Bônus' },
]

const FASES_MATA_MATA = ['16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final']

type StatusFiltro = 'todos' | 'pendentes' | 'finalizados'

export function JogosClient({ jogos: initialJogos, selecoes, copaResultados, initialTab, ultimoSync, totalMapeados }: Props) {
  const [jogos, setJogos] = useState<JogoComSelecoes[]>(initialJogos)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos')
  const [soPlaceholder, setSoPlaceholder] = useState(false)

  const jogoByNumero = useMemo(
    () => new Map(jogos.map((j) => [j.numero_jogo, j])),
    [jogos],
  )

  function handleAtualizado(atualizado: JogoComSelecoes) {
    setJogos((prev) => prev.map((j) => (j.id === atualizado.id ? atualizado : j)))
  }

  const isMataMatataTab = FASES_MATA_MATA.includes(activeTab)

  const jogosFiltrados = useMemo(() => {
    return jogos
      .filter((j) => j.fase === activeTab)
      .filter((j) => {
        if (statusFiltro === 'pendentes') return !j.finalizado
        if (statusFiltro === 'finalizados') return j.finalizado
        return true
      })
      .filter((j) => {
        if (!soPlaceholder) return true
        return j.selecao_casa_id === null || j.selecao_fora_id === null
      })
  }, [jogos, activeTab, statusFiltro, soPlaceholder])

  return (
    <div>
      <SyncStatus ultimoSync={ultimoSync} totalMapeados={totalMapeados} />
      {/* Tabs */}
      <div className="border-border mb-6 flex overflow-x-auto border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setStatusFiltro('todos')
              setSoPlaceholder(false)
            }}
            className={[
              'flex-shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'bonus' ? (
        <BonusForm copaResultados={copaResultados} selecoes={selecoes} />
      ) : (
        <>
          {/* Filtros */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="border-border flex overflow-hidden rounded-md border">
              {(['todos', 'pendentes', 'finalizados'] as StatusFiltro[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFiltro(f)}
                  className={[
                    'px-3 py-1.5 text-xs capitalize transition-colors',
                    statusFiltro === f
                      ? 'bg-accent text-bg-base font-semibold'
                      : 'bg-bg-elevated text-text-muted hover:text-text-primary',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
            {isMataMatataTab && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={soPlaceholder}
                  onChange={(e) => setSoPlaceholder(e.target.checked)}
                  className="accent-accent h-4 w-4"
                />
                <span className="text-text-muted">Só com placeholder pendente</span>
              </label>
            )}
          </div>

          {/* Lista */}
          <div className="panel">
            {jogosFiltrados.length === 0 ? (
              <p className="text-text-muted p-6 text-center text-sm">Nenhum jogo nesta fase/filtro.</p>
            ) : (
              jogosFiltrados.map((jogo) => (
                <JogoRow
                  key={jogo.id}
                  jogo={jogo}
                  selecoes={selecoes}
                  jogoByNumero={jogoByNumero}
                  onAtualizado={handleAtualizado}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
