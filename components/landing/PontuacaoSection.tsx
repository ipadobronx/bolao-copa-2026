type ScoreRow = {
  action: string
  pts: string
  desc: string
}

const SCORE_ROWS: ScoreRow[] = [
  { action: 'Placar exato', pts: '10 pts', desc: 'Acertou gols dos dois times' },
  { action: 'Vencedor + saldo', pts: '7 pts', desc: 'Certo quem ganhou e por quantos gols' },
  { action: 'Só o vencedor', pts: '5 pts', desc: 'Ou empate — sem acertar placar' },
  { action: 'Parcial (+bônus)', pts: '+2 pts', desc: 'Acertou gols de um time isoladamente' },
]

type Phase = {
  name: string
  mult: string
  gradient: string
}

const PHASES: Phase[] = [
  { name: 'Grupos', mult: '1×', gradient: 'from-yellow-400/80 to-yellow-500/80' },
  { name: '16avos', mult: '1.5×', gradient: 'from-yellow-400 to-green-400/80' },
  { name: 'Oitavas', mult: '2×', gradient: 'from-yellow-400 to-green-400' },
  { name: 'Quartas', mult: '2.5×', gradient: 'from-yellow-500 to-green-500' },
  { name: 'Semis', mult: '3×', gradient: 'from-green-400 to-emerald-400' },
  { name: 'Final', mult: '4×', gradient: 'from-green-500 to-emerald-500' },
]

const BONUS_ROWS = [
  { tipo: 'Campeão', pts: '50 pts' },
  { tipo: 'Vice', pts: '30 pts' },
  { tipo: '3º / 4º lugar', pts: '15 pts cada' },
  { tipo: 'Artilheiro', pts: '25 pts' },
  { tipo: 'Revelação', pts: '15 pts' },
]

export function PontuacaoSection() {
  return (
    <section
      id="pontuacao"
      className="relative py-20 md:py-28"
      style={{
        background: `
          radial-gradient(ellipse at top, rgba(16,185,129,0.08), transparent 55%),
          var(--color-bg-card)
        `,
      }}
    >
      <div className="relative z-10 mx-auto max-w-[1200px] px-6">
        <div className="mb-12 text-center">
          <h2 className="font-display mb-3 text-[clamp(40px,7vw,64px)] tracking-tight">
            Sistema de <span className="text-accent">pontuação</span>
          </h2>
          <p className="text-text-secondary mx-auto max-w-xl text-base">
            Transparente e <span className="text-success font-semibold">competitivo</span>.
            Quanto mais difícil a fase, mais vale o acerto.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
          {/* Score table */}
          <div>
            <h3 className="text-text-muted mb-4 font-mono text-[11px] uppercase tracking-[1.5px]">
              Por resultado de jogo
            </h3>
            <div className="overflow-hidden rounded-2xl border border-border">
              {SCORE_ROWS.map((row, i) => (
                <div
                  key={row.action}
                  className={`flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02] ${i < SCORE_ROWS.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{row.action}</div>
                    <div className="text-text-muted mt-0.5 text-xs">{row.desc}</div>
                  </div>
                  <div className="text-accent font-mono text-lg font-bold tabular-nums">{row.pts}</div>
                </div>
              ))}
            </div>

            <h3 className="text-text-muted mb-4 mt-8 font-mono text-[11px] uppercase tracking-[1.5px]">
              Bônus pré-copa
            </h3>
            <div className="overflow-hidden rounded-2xl border border-border">
              {BONUS_ROWS.map((row, i) => (
                <div
                  key={row.tipo}
                  className={`flex items-center justify-between px-5 py-3 transition hover:bg-white/[0.02] ${i < BONUS_ROWS.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="text-text-secondary text-sm">{row.tipo}</span>
                  <span className="text-accent font-mono text-sm font-bold">{row.pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Multipliers */}
          <div>
            <h3 className="text-text-muted mb-4 font-mono text-[11px] uppercase tracking-[1.5px]">
              Multiplicadores por fase
            </h3>
            <div className="space-y-2.5">
              {PHASES.map((phase) => (
                <div key={phase.name} className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <span className="text-text-muted font-mono text-xs">{phase.name}</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${phase.gradient}`}
                        style={{ width: `${(parseFloat(phase.mult) / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className={`w-14 shrink-0 rounded-lg bg-gradient-to-r px-2.5 py-1.5 text-center font-mono text-sm font-bold text-bg-dark ${phase.gradient}`}>
                    {phase.mult}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-success/20 bg-success/5 mt-8 rounded-2xl border p-5">
              <p className="text-text-primary text-sm leading-relaxed">
                <span className="text-success font-semibold">Acertou a final?</span> Vale{' '}
                <span className="text-accent font-bold">4× mais</span> do que um jogo de grupos.{' '}
                Bolão competitivo até o último apito.
              </p>
              <p className="text-text-muted mt-2 text-xs">
                Fórmula: <code className="text-success/80 font-mono">Math.round(pontosBase × multiplicador)</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
