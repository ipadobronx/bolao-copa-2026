'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import { BandeiraImg } from '@/components/ui/BandeiraImg'
import { FormaDots } from '@/components/ranking/FormaDots'
import { tituloDesempenho } from '@/lib/ranking/titulo'
import { agruparPorDia, type PalpiteJogo } from '@/lib/ranking/agruparPorDia'
import type { RankingRowData } from './RankingRow'

type BonusSel = { nome: string; bandeira: string } | null
type Tabela = { bilheteId: string; numero: number; pontos: number; posicao: number }
type PerfilData = {
  campeao: BonusSel
  vice: BonusSel
  terceiro: BonusSel
  quarto: BonusSel
  revelacao: BonusSel
  artilheiro: string | null
  numero: number
  pontos: number
  posicao: number
  exatos: number
  forma: string[]
  tabelas: Tabela[]
  totalTabelas: number
  palpites: PalpiteJogo[]
}

export function PerfilModal({
  entry,
  total,
  onClose,
}: {
  entry: RankingRowData | null
  total: number
  onClose: () => void
}) {
  const [data, setData] = useState<PerfilData | null>(null)
  const [loading, setLoading] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const [selBilheteId, setSelBilheteId] = useState<string | null>(entry?.melhorBilheteId ?? null)

  useEffect(() => {
    setSelBilheteId(entry?.melhorBilheteId ?? null)
  }, [entry?.melhorBilheteId])

  useEffect(() => {
    setVerTodos(false)
    if (!selBilheteId) {
      setData(null)
      return
    }
    let cancel = false
    setLoading(true)
    setData(null)
    fetch(`/api/perfil/${selBilheteId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PerfilData | null) => {
        if (!cancel) setData(d)
      })
      .catch(() => {
        if (!cancel) setData(null)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [selBilheteId])

  const isDefault = entry != null && selBilheteId === entry.melhorBilheteId
  const selo = !entry
    ? null
    : isDefault
      ? tituloDesempenho(entry.posicao, total)
      : data
        ? tituloDesempenho(data.posicao, data.totalTabelas)
        : null
  const pontos = isDefault ? (entry?.pontosTotais ?? 0) : (data?.pontos ?? 0)
  const exatos = isDefault ? (entry?.acertosExatos ?? 0) : (data?.exatos ?? 0)
  const forma = isDefault ? (entry?.forma ?? null) : (data?.forma ?? null)
  const subtitle = !entry
    ? ''
    : isDefault
      ? `${entry.posicao}º no ranking`
      : data
        ? `Tabela nº${data.numero} · ${data.posicao}ª de ${data.totalTabelas}`
        : 'Carregando…'
  const topReady = isDefault || data != null

  const grupos = data ? agruparPorDia(data.palpites) : []
  const gruposVisiveis = verTodos ? grupos : grupos.slice(0, 1)
  const escondidos = grupos.slice(1).reduce((n, g) => n + g.jogos.length, 0)

  const bonusSelecoes: [string, string, BonusSel][] = [
    ['🏆', 'Campeão', data?.campeao ?? null],
    ['🥈', 'Vice', data?.vice ?? null],
    ['🥉', '3º lugar', data?.terceiro ?? null],
    ['4️⃣', '4º lugar', data?.quarto ?? null],
  ]

  return (
    <Dialog.Root open={entry !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0c0e]/70 p-5 text-text-primary shadow-2xl shadow-black/50 outline-none backdrop-blur-2xl scrollbar-glass">
          {entry && (
            <>
              <Dialog.Title className="sr-only">Perfil de {entry.nome}</Dialog.Title>
              <Dialog.Description className="sr-only">Card do apostador no ranking</Dialog.Description>

              {!isDefault && (
                <button
                  type="button"
                  onClick={() => setSelBilheteId(entry.melhorBilheteId ?? null)}
                  className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text-primary"
                >
                  ← Voltar pro card do ranking
                </button>
              )}

              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-bg-dark"
                  style={{ background: avatarColor(entry.userId) }}
                  aria-hidden="true"
                >
                  {avatarInitials(entry.nome)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-lg font-bold">{entry.nome}</div>
                  <div className="font-mono text-xs text-text-muted">{subtitle}</div>
                </div>
              </div>

              {selo && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#1f1f23] bg-[#111] px-3 py-2">
                  <span className="text-2xl" aria-hidden="true">{selo.emoji}</span>
                  <span className="font-display text-xl tracking-wide">{selo.label}</span>
                </div>
              )}

              {topReady ? (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-accent text-xl font-bold tabular-nums">{pontos}</div>
                    <div className="text-[10px] uppercase text-text-muted">Pontos</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold tabular-nums">{exatos}</div>
                    <div className="text-[10px] uppercase text-text-muted">Exatos</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 items-center"><FormaDots forma={forma} /></div>
                    <div className="text-[10px] uppercase text-text-muted">Últimos 5</div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-text-muted">Carregando…</div>
              )}

              <div className="mt-4 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Palpites de bônus</div>
                {loading ? (
                  <div className="text-sm text-text-muted">Carregando…</div>
                ) : (
                  <>
                    {bonusSelecoes.map(([icon, label, sel]) => (
                      <div key={label} className="flex items-center gap-2 text-sm">
                        <span aria-hidden="true">{icon}</span>
                        <span className="w-20 shrink-0 text-xs text-text-muted">{label}</span>
                        {sel ? (
                          <>
                            <BandeiraImg emoji={sel.bandeira} nome={sel.nome} size={16} />
                            <strong className="truncate">{sel.nome}</strong>
                          </>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">⚽</span>
                      <span className="w-20 shrink-0 text-xs text-text-muted">Artilheiro</span>
                      {data?.artilheiro ? (
                        <strong className="truncate">{data.artilheiro}</strong>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">🌟</span>
                      <span className="w-20 shrink-0 text-xs text-text-muted">Revelação</span>
                      {data?.revelacao ? (
                        <>
                          <BandeiraImg emoji={data.revelacao.bandeira} nome={data.revelacao.nome} size={16} />
                          <strong className="truncate">{data.revelacao.nome}</strong>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {data && data.tabelas.length > 1 && (
                <div className="mt-4 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Pontuação por tabela</div>
                  {data.tabelas.map((t) => {
                    const sel = t.bilheteId === selBilheteId
                    return (
                      <button
                        key={t.bilheteId}
                        type="button"
                        onClick={() => setSelBilheteId(t.bilheteId)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                          sel ? 'bg-white/[0.06] ring-1 ring-accent/40' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>Tabela nº{t.numero}</span>
                          {t.bilheteId === entry.melhorBilheteId && (
                            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
                              ★ ranking
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-text-muted">
                          <strong className="text-text-primary">{t.pontos}</strong> pts · {t.posicao}ª de {data.totalTabelas}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {grupos.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Palpites nos jogos</div>
                  {gruposVisiveis.map((grupo) => (
                    <div key={grupo.dia} className="space-y-1">
                      <div className="font-mono text-[10px] text-text-muted">{grupo.label}</div>
                      {grupo.jogos.map((j) => (
                        <div key={j.numeroJogo} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-1">
                            <BandeiraImg emoji={j.bandeiraCasa} nome={j.casa} size={14} />
                            <span className="truncate">{j.casa}</span>
                            {j.palpiteCasa != null && j.palpiteFora != null ? (
                              <strong className="px-1 tabular-nums">{j.palpiteCasa}×{j.palpiteFora}</strong>
                            ) : (
                              <span className="px-1 text-text-muted">— sem palpite</span>
                            )}
                            <span className="truncate">{j.fora}</span>
                            <BandeiraImg emoji={j.bandeiraFora} nome={j.fora} size={14} />
                          </span>
                          <span className="shrink-0 font-mono text-text-muted">
                            {j.finalizado ? (
                              <>
                                real {j.realCasa}×{j.realFora}
                                {j.palpiteCasa != null && (
                                  <strong className="text-accent"> · +{j.pontos ?? 0}</strong>
                                )}
                              </>
                            ) : (
                              'em andamento'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {grupos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setVerTodos((v) => !v)}
                      aria-expanded={verTodos}
                      className="w-full rounded-lg border border-white/10 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary"
                    >
                      {verTodos ? 'Ver menos' : `Ver todos os palpites (+${escondidos})`}
                    </button>
                  )}
                </div>
              )}

              <Dialog.Close className="mt-5 w-full rounded-lg bg-bg-elevated py-2 text-sm font-semibold text-text-muted hover:text-text-primary">
                Fechar
              </Dialog.Close>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
