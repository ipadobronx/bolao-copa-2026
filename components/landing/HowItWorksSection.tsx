import { UserPlus, QrCode, Target, BarChart3, Gift } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Step = {
  icon: LucideIcon
  title: string
  description: string
  accent?: boolean
  live?: boolean
}

const STEPS: Step[] = [
  {
    icon: UserPlus,
    title: 'Cadastro grátis',
    description: 'Crie sua conta com e-mail em segundos. Sem burocracia, sem taxa de cadastro.',
  },
  {
    icon: QrCode,
    title: 'Compre via PIX',
    description: 'R$ 20 por tabela. Quantas quiser. Confirmação instantânea.',
  },
  {
    icon: Target,
    title: 'Palpite rodada a rodada',
    description: 'Palpite até o apito de cada jogo. Fase de grupos, 16avos, oitavas... até a final.',
    accent: true,
  },
  {
    icon: BarChart3,
    title: 'Ranking ao vivo',
    description: 'Pontuação atualiza em tempo real. Placar exato vale 10 pts. Mata-mata multiplica.',
    live: true,
  },
  {
    icon: Gift,
    title: 'Cashback na campeã',
    description: 'Comprou R$ 100+? Escolha uma seleção. Se ela vencer a Copa, você leva de volta no PIX.',
    accent: true,
  },
]

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
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
            Como <span className="text-accent">funciona</span>
          </h2>
          <p className="text-text-secondary mx-auto max-w-xl text-base">
            Simples, transparente e <span className="text-success font-semibold">ao vivo</span>.
            Palpite <span className="text-success font-semibold">a cada rodada</span> — não só no
            início da Copa.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <article
                key={step.title}
                className={`how-it-works-card group relative${step.accent ? ' how-it-works-card-accent' : ''}`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${step.accent ? 'bg-success/15 group-hover:bg-success/25' : 'bg-accent/15 group-hover:bg-accent/20'}`}>
                    <Icon
                      className={`h-6 w-6 transition-colors ${step.accent ? 'text-success' : 'text-accent'}`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-text-muted/50 tabular-nums">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-display mb-2 text-xl tracking-tight">
                  {step.title}
                  {step.live && (
                    <span
                      aria-hidden="true"
                      className="bg-success animate-pulse-dot ml-2 inline-block h-2 w-2 rounded-full align-middle"
                    />
                  )}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">{step.description}</p>

                {step.accent && (
                  <div className="border-success/30 bg-success/5 mt-4 rounded-lg border px-2.5 py-1.5">
                    <span className="text-success font-mono text-[10px] font-bold uppercase tracking-wider">
                      Diferencial
                    </span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
