'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import { BandeiraImg } from '@/components/ui/BandeiraImg'
import { FormaDots } from '@/components/ranking/FormaDots'
import { tituloDesempenho } from '@/lib/ranking/titulo'
import type { RankingRowData } from './RankingRow'

type Bonus = {
  campeao: { nome: string; bandeira: string } | null
  artilheiro: string | null
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
  const [bonus, setBonus] = useState<Bonus | null>(null)
  const [loading, setLoading] = useState(false)
  const bilheteId = entry?.melhorBilheteId ?? null

  useEffect(() => {
    if (!bilheteId) {
      setBonus(null)
      return
    }
    let cancel = false
    setLoading(true)
    setBonus(null)
    fetch(`/api/perfil/${bilheteId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Bonus | null) => {
        if (!cancel) setBonus(data)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [bilheteId])

  const selo = entry ? tituloDesempenho(entry.posicao, total) : null

  return (
    <Dialog.Root open={entry !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#1f1f23] bg-[#0c0c0e] p-5 text-text-primary outline-none">
          {entry && selo && (
            <>
              <Dialog.Title className="sr-only">Perfil de {entry.nome}</Dialog.Title>
              <Dialog.Description className="sr-only">Card do apostador no ranking</Dialog.Description>

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
                  <div className="font-mono text-xs text-text-muted">{entry.posicao}º no ranking</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#1f1f23] bg-[#111] px-3 py-2">
                <span className="text-2xl" aria-hidden="true">{selo.emoji}</span>
                <span className="font-display text-xl tracking-wide">{selo.label}</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-accent text-xl font-bold tabular-nums">{entry.pontosTotais}</div>
                  <div className="text-[10px] uppercase text-text-muted">Pontos</div>
                </div>
                <div>
                  <div className="text-xl font-bold tabular-nums">{entry.acertosExatos}</div>
                  <div className="text-[10px] uppercase text-text-muted">Exatos</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex h-7 items-center"><FormaDots forma={entry.forma} /></div>
                  <div className="text-[10px] uppercase text-text-muted">Últimos 5</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Palpites de bônus</div>
                {loading ? (
                  <div className="text-sm text-text-muted">Carregando…</div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">🏆</span>
                      {bonus?.campeao ? (
                        <>
                          <BandeiraImg emoji={bonus.campeao.bandeira} nome={bonus.campeao.nome} size={18} />
                          <strong>{bonus.campeao.nome}</strong>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">⚽</span>
                      {bonus?.artilheiro ? <strong>{bonus.artilheiro}</strong> : <span className="text-text-muted">—</span>}
                    </div>
                  </>
                )}
              </div>

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
