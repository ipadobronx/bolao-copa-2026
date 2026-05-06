import Link from 'next/link'
import { GlobeCashback } from '@/components/landing/GlobeCashback'

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32"
      style={{
        background: `
          radial-gradient(ellipse at top right, rgba(250,204,21,0.18), transparent 55%),
          radial-gradient(ellipse at bottom left, rgba(16,185,129,0.10), transparent 55%),
          var(--color-bg-dark)
        `,
      }}
    >
      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1200px] px-6">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">

          {/* LEFT — content */}
          <div>
            {/* Badge */}
            <div className="border-accent/30 bg-accent/10 text-accent mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-xs font-semibold tracking-[1px] uppercase">
              <span aria-hidden="true" className="bg-success animate-pulse-dot h-1.5 w-1.5 rounded-full" />
              Copa 2026 · EUA · México · Canadá
            </div>

            {/* Prize — hero visual */}
            <div className="mb-4">
              <p className="text-text-muted mb-1 font-mono text-xs uppercase tracking-[2px]">
                Prêmio total garantido
              </p>
              <div
                className="font-display text-accent animate-prize-glow leading-none"
                style={{ fontSize: 'clamp(72px, 14vw, 144px)' }}
                aria-label="R$ 10.000 em prêmios"
              >
                <span className="mr-1" style={{ fontSize: '0.42em', verticalAlign: 'super' }}>R$</span>
                10.000
              </div>
            </div>

            {/* Headline */}
            <h1 className="font-display text-text-primary mb-3 text-[clamp(28px,5vw,48px)] leading-tight tracking-tight">
              O melhor bolão da Copa 2026.
            </h1>

            {/* Subheadline */}
            <p className="text-text-secondary mb-8 max-w-[500px] text-base leading-relaxed md:text-lg">
              Palpite a cada rodada,{' '}
              <span className="text-success font-semibold">ranking ao vivo</span>, prêmio garantido.{' '}
              <span className="text-text-primary font-semibold">R$ 20 por tabela</span> — comprou R$ 100+,
              escolhe uma seleção e leva cashback se ela for campeã.
            </p>

            {/* CTAs */}
            <div className="mb-10 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary btn-hero">
                Quero participar →
              </Link>
              <a href="#how-it-works" className="btn-secondary btn-hero">
                Como funciona
              </a>
            </div>

            {/* Stats inline */}
            <div className="border-border flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-6">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-accent text-3xl leading-none">104</span>
                <span className="text-text-muted font-mono text-[11px] uppercase tracking-[1px]">jogos</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-accent text-3xl leading-none">48</span>
                <span className="text-text-muted font-mono text-[11px] uppercase tracking-[1px]">seleções</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span aria-hidden="true" className="bg-success animate-pulse-dot mr-0.5 h-2 w-2 self-center rounded-full" />
                <span className="font-display text-accent text-3xl leading-none">Ranking</span>
                <span className="text-success font-mono text-[11px] uppercase tracking-[1px]">ao vivo</span>
              </div>
            </div>
          </div>

          {/* RIGHT — Globe */}
          <div className="flex items-center justify-center pt-8 md:pt-0">
            <div className="w-full max-w-[420px]">
              <GlobeCashback className="w-full" />
              <p className="text-text-muted mt-4 text-center font-mono text-[10px] uppercase tracking-[1.5px]">
                13 seleções elegíveis ao cashback
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
