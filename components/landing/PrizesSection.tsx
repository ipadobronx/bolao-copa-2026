
export function PrizesSection() {
  return (
    <section id="premios" className="relative py-20 md:py-28" style={{ background: 'var(--color-bg-dark)' }}>
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.05), transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6">
        <div className="mb-12 text-center">
          <span className="bg-accent/10 border-accent/25 text-accent mb-4 inline-block rounded-full border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[1.5px]">
            🏆 Premiação
          </span>
          <h2 className="font-display text-[clamp(40px,7vw,72px)] leading-none tracking-tight">
            <span className="text-accent">R$ 10.000</span>
            <br />
            <span className="text-success">em prêmios reais</span>
          </h2>
          <p className="text-text-secondary mt-3 text-base">
            <strong className="text-text-primary">Top 3 levam tudo.</strong> Brigue pelo ouro.
          </p>
        </div>

        <div className="mx-auto max-w-2xl">
          {/* Pódio: 2º — 1º (destaque) — 3º */}
          <div className="grid grid-cols-[1fr_1.4fr_1fr] items-end gap-3">
            {/* 2º */}
            <div
              className="flex flex-col items-center justify-end rounded-xl border bg-bg-elevated px-3 pt-5 pb-4 text-center transition hover:-translate-y-0.5"
              style={{ borderColor: '#C0C0C0', boxShadow: '0 0 24px rgba(16,185,129,0.20)' }}
            >
              <span className="mb-1 text-3xl" aria-hidden="true">🥈</span>
              <div className="font-display text-accent text-2xl leading-none">R$ 2.000</div>
              <div className="text-text-muted mt-0.5 font-mono text-[10px] uppercase tracking-[1px]">
                20% do prêmio
              </div>
              <div className="text-text-primary mt-2 text-sm font-semibold">Vice</div>
              <div className="text-text-muted font-mono text-[11px]">2º</div>
            </div>

            {/* 1º — destaque grande, prize-glow pulsando */}
            <div
              className="flex flex-col items-center justify-end rounded-2xl border-2 bg-bg-elevated px-4 pt-7 pb-5 text-center transition hover:-translate-y-1"
              style={{
                borderColor: '#FFD700',
                boxShadow:
                  '0 0 48px rgba(250,204,21,0.40), 0 0 96px rgba(250,204,21,0.18)',
              }}
            >
              <span className="mb-2 text-4xl" aria-hidden="true">🥇</span>
              <div
                className="font-display text-accent animate-prize-glow leading-none"
                style={{ fontSize: 'clamp(32px, 6vw, 48px)' }}
              >
                R$ 7.000
              </div>
              <div className="text-accent/85 mt-1 font-mono text-[11px] font-bold uppercase tracking-[1.5px]">
                70% do prêmio total
              </div>
              <div className="text-text-primary mt-3 text-base font-bold">Campeão</div>
              <div className="text-text-muted font-mono text-[11px]">1º</div>
            </div>

            {/* 3º */}
            <div
              className="flex flex-col items-center justify-end rounded-xl border bg-bg-elevated px-3 pt-4 pb-4 text-center transition hover:-translate-y-0.5"
              style={{ borderColor: '#CD7F32', boxShadow: '0 0 18px rgba(250,204,21,0.18)' }}
            >
              <span className="mb-1 text-2xl" aria-hidden="true">🥉</span>
              <div className="font-display text-accent text-xl leading-none">R$ 1.000</div>
              <div className="text-text-muted mt-0.5 font-mono text-[10px] uppercase tracking-[1px]">
                10% do prêmio
              </div>
              <div className="text-text-primary mt-2 text-sm font-semibold">Terceiro</div>
              <div className="text-text-muted font-mono text-[11px]">3º</div>
            </div>
          </div>

          <p className="text-text-muted mt-6 text-center font-mono text-xs">
            Prêmios pagos via PIX em até 48h após a final · 19/07/2026
          </p>
        </div>
      </div>
    </section>
  )
}
