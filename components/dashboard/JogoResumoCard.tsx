'use client'

import { useState } from 'react'
import { BandeiraImg } from '@/components/ui/BandeiraImg'
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import { formatDiasHoras } from '@/lib/dashboard/countdown'
import type { JogoResumo, Tendencia } from '@/lib/dashboard/resumo-jogo'

const VISIVEIS = 6

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function Barra({ label, n, total, destaque }: { label: string; n: number; total: number; destaque: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 truncate text-text-secondary">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className={`block h-full rounded-full ${destaque ? 'bg-accent' : 'bg-slate-500'}`}
          style={{ width: `${pct(n, total)}%` }}
        />
      </span>
      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-text-muted">
        {pct(n, total)}% ({n})
      </span>
    </div>
  )
}

export function JogoResumoCard({ jogo, proximo }: { jogo: JogoResumo; proximo: boolean }) {
  const [verTodos, setVerTodos] = useState(false)
  const t: Tendencia = jogo.tendencia
  const maior = Math.max(t.casa, t.empate, t.fora)

  let countdown = ''
  if (proximo) {
    const { dias, horas } = formatDiasHoras(new Date(), new Date(jogo.dataHora))
    countdown = dias > 0 ? `trava em ${dias}d ${horas}h` : `trava em ${horas}h`
  }

  const lista = jogo.palpites ?? []
  const visiveis = verTodos ? lista : lista.slice(0, VISIVEIS)

  return (
    <div className="rounded-2xl border border-[#1b1b1e] bg-[#08080a] p-4">
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            proximo ? 'bg-accent/15 text-accent' : 'bg-green-500/15 text-green-400'
          }`}
        >
          {proximo ? 'Próximo' : 'Jogo atual'}
        </span>
        <span className="font-mono text-[10px] text-text-muted">
          {proximo ? countdown : `${jogo.total} palpites`}
        </span>
      </div>

      <div className="my-3 flex items-center justify-center gap-2 text-sm font-bold">
        <BandeiraImg emoji={jogo.bandeiraCasa} nome={jogo.casa} size={18} />
        <span className="truncate">{jogo.casa}</span>
        <span className="text-text-muted text-[11px] font-semibold">vs</span>
        <span className="truncate">{jogo.fora}</span>
        <BandeiraImg emoji={jogo.bandeiraFora} nome={jogo.fora} size={18} />
      </div>

      {jogo.finalizado && jogo.realCasa != null && jogo.realFora != null && (
        <div className="mb-2 text-center font-mono text-xs text-text-muted">
          Resultado: <strong className="text-text-primary">{jogo.realCasa}×{jogo.realFora}</strong>
        </div>
      )}

      <div className="text-[10px] uppercase tracking-wider text-text-muted">📈 Tendência</div>
      <div className="mt-1 space-y-1">
        <Barra label={jogo.casa} n={t.casa} total={jogo.total} destaque={t.casa === maior && maior > 0} />
        <Barra label="Empate" n={t.empate} total={jogo.total} destaque={t.empate === maior && maior > 0} />
        <Barra label={jogo.fora} n={t.fora} total={jogo.total} destaque={t.fora === maior && maior > 0} />
      </div>

      <div className="mt-3 text-[10px] uppercase tracking-wider text-text-muted">🎯 Placares mais palpitados</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {jogo.topPlacares.length === 0 ? (
          <span className="text-xs text-text-muted">—</span>
        ) : (
          jogo.topPlacares.map((p) => (
            <span
              key={`${p.gc}x${p.gf}`}
              className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent"
            >
              {p.gc}×{p.gf} <span className="font-semibold text-text-muted">({p.count})</span>
            </span>
          ))
        )}
      </div>

      {proximo ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border bg-bg-elevated px-3 py-2.5 text-xs text-text-muted">
          🔒 O palpite de cada um aparece quando o jogo travar.
        </div>
      ) : (
        <>
          <div className="mt-3 text-[10px] uppercase tracking-wider text-text-muted">👥 Palpite de cada um</div>
          <div className="mt-1 space-y-1.5">
            {visiveis.map((p) => (
              <div key={p.userId} className="bg-bg-elevated border-border flex items-center gap-2 rounded-xl border px-2.5 py-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-bg-dark"
                  style={{ background: avatarColor(p.userId) }}
                  aria-hidden="true"
                >
                  {avatarInitials(p.nome)}
                </span>
                <span className="flex-1 truncate text-sm">{p.nome}</span>
                {p.isLider && (
                  <span className="rounded-full border border-accent/40 px-1.5 py-0.5 text-[8px] font-bold uppercase text-accent">
                    ★ ranking
                  </span>
                )}
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                  {p.gc}×{p.gf}
                  {jogo.finalizado && p.pts != null && (
                    <strong className="text-accent"> · +{p.pts}</strong>
                  )}
                </span>
              </div>
            ))}
          </div>
          {lista.length > VISIVEIS && (
            <button
              type="button"
              onClick={() => setVerTodos((v) => !v)}
              aria-expanded={verTodos}
              className="mt-2 w-full rounded-lg border border-white/10 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary"
            >
              {verTodos ? 'Ver menos' : `Ver todos os ${lista.length} palpites`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
