import { Activity, Zap, Clock, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Stat = {
  icon: LucideIcon
  value: string
  label: string
  sub: string
}

const STATS: Stat[] = [
  {
    icon: Activity,
    value: 'Ranking',
    label: 'em tempo real',
    sub: 'Atualiza a cada gol. Sem delay.',
  },
  {
    icon: Zap,
    value: 'PIX',
    label: 'em segundos',
    sub: 'Confirmação instantânea. Palpite liberado na hora.',
  },
  {
    icon: Clock,
    value: 'Palpite',
    label: 'até o apito',
    sub: 'Jogo a jogo. Muda de ideia até o último minuto.',
  },
]

export function SocialProofSection() {
  return (
    <section
      className="relative py-20 md:py-24"
      style={{
        background: `
          radial-gradient(ellipse at top, rgba(16,185,129,0.08), transparent 55%),
          var(--color-bg-card)
        `,
      }}
    >
      <div className="relative z-10 mx-auto max-w-[1200px] px-6">
        <div className="mb-10 text-center">
          <p className="text-text-muted font-mono text-sm uppercase tracking-[2px]">
            Por que a Mala na Copa?
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STATS.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="border-border hover:border-accent/40 group relative flex flex-col items-center rounded-2xl border bg-bg-elevated p-8 text-center transition hover:-translate-y-1"
              >
                <CheckCircle2
                  aria-hidden="true"
                  className="text-success/80 absolute right-3 top-3 h-4 w-4"
                  strokeWidth={2.5}
                />
                <div className="bg-accent/12 group-hover:bg-accent/20 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl transition">
                  <Icon className="text-accent h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <div className="font-display text-accent text-[40px] leading-none">{stat.value}</div>
                <div className="text-text-primary mt-1 text-lg font-semibold">{stat.label}</div>
                <p className="text-text-muted mt-2 text-sm leading-relaxed">{stat.sub}</p>
              </div>
            )
          })}
        </div>

        {/* Final CTA */}
        <div className="mt-16 text-center">
          <p className="text-text-secondary mb-6 text-lg">
            Copa começa em <strong className="text-text-primary">11 de junho de 2026</strong>.
            Garanta sua vaga agora.
          </p>
          <a
            href="/login"
            className="btn-primary btn-hero text-[16px]"
          >
            Comprar minha tabela →
          </a>
          <p className="text-text-muted mt-3 font-mono text-xs">R$ 20 por tabela · PIX na hora</p>
        </div>
      </div>
    </section>
  )
}
