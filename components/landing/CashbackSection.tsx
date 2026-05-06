import Link from 'next/link'
import { BandeiraImg } from '@/components/ui/BandeiraImg'

type TierGroup = {
  mult: number
  label: string
  pct: string
  selecoes: { name: string; emoji: string }[]
  highlight: boolean
}

const TIERS: TierGroup[] = [
  {
    mult: 5,
    label: 'Azarões',
    pct: '500%',
    selecoes: [
      { name: 'Bélgica', emoji: '🇧🇪' },
      { name: 'Colômbia', emoji: '🇨🇴' },
      { name: 'Noruega', emoji: '🇳🇴' },
      { name: 'Suíça', emoji: '🇨🇭' },
      { name: 'Uruguai', emoji: '🇺🇾' },
    ],
    highlight: true,
  },
  {
    mult: 3,
    label: 'Time B',
    pct: '300%',
    selecoes: [
      { name: 'Alemanha', emoji: '🇩🇪' },
      { name: 'Holanda', emoji: '🇳🇱' },
      { name: 'Portugal', emoji: '🇵🇹' },
    ],
    highlight: false,
  },
  {
    mult: 2,
    label: 'Sul-americanos',
    pct: '200%',
    selecoes: [
      { name: 'Argentina', emoji: '🇦🇷' },
      { name: 'Brasil', emoji: '🇧🇷' },
    ],
    highlight: false,
  },
  {
    mult: 1,
    label: 'Favoritas',
    pct: '100%',
    selecoes: [
      { name: 'Inglaterra', emoji: '🇬🇧' },
      { name: 'Espanha', emoji: '🇪🇸' },
      { name: 'França', emoji: '🇫🇷' },
    ],
    highlight: false,
  },
]

export function CashbackSection() {
  return (
    <section
      id="cashback"
      className="border-border border-y py-20 md:py-28"
      style={{
        background: `
          linear-gradient(135deg, rgba(250,204,21,0.06), rgba(16,185,129,0.04)),
          var(--color-bg-dark)
        `,
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-[1fr_1.2fr]">

          {/* LEFT — copy */}
          <div className="md:sticky md:top-28">
            <span className="bg-brasil mb-4 inline-block rounded px-3 py-1 font-mono text-[11px] font-bold tracking-[1px] text-white uppercase">
              🎁 Cashback Especial
            </span>
            <h2 className="font-display mb-4 leading-[0.95]" style={{ fontSize: 'clamp(48px,8vw,72px)' }}>
              Comprou <span className="text-accent">R$ 100+</span>
              <br />
              Escolheu a campeã?
              <br />
              <span className="text-success">Dinheiro de volta.</span>
            </h2>
            <p className="text-text-secondary mb-4 text-base leading-relaxed">
              Compre 5 ou mais tabelas e escolha uma seleção. Se ela for campeã da Copa 2026, você
              recebe de volta no PIX — com multiplicador que pode chegar a{' '}
              <strong className="text-success">5×</strong> o valor pago.
            </p>

            {/* Example callout */}
            <div className="border-success/30 bg-success/8 mb-8 rounded-xl border px-4 py-4">
              <p className="text-text-primary text-sm font-semibold">Exemplo real:</p>
              <p className="text-text-secondary mt-1 text-sm">
                Comprou <span className="text-accent font-bold">R$ 200</span> e escolheu a Bélgica
                (5×). Se a Bélgica for campeã →{' '}
                <span className="text-success font-bold">R$ 1.000 de volta no PIX.</span>
              </p>
            </div>

            <Link href="/login" className="btn-primary btn-hero">
              Garantir meu cashback →
            </Link>

            <p className="text-text-muted mt-4 font-mono text-xs">
              Sem limite de vagas por seleção · Escolha até o início da Copa
            </p>
          </div>

          {/* RIGHT — tier grid */}
          <div className="space-y-4">
            {TIERS.map((tier) => (
              <div
                key={tier.mult}
                className={`overflow-hidden rounded-2xl border ${
                  tier.highlight
                    ? 'border-success/40 shadow-[0_0_24px_rgba(16,185,129,0.12)]'
                    : 'border-border'
                } bg-bg-elevated`}
              >
                {/* Tier header */}
                <div className={`flex items-center justify-between px-5 py-3 ${tier.highlight ? 'bg-success/8' : 'bg-bg-card'}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg px-2.5 py-1 font-mono text-sm font-bold ${
                      tier.highlight ? 'bg-success text-bg-dark' : 'bg-bg-elevated text-text-primary border border-border-strong'
                    }`}>
                      {tier.mult}×
                    </div>
                    <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
                      {tier.label}
                    </span>
                    {tier.highlight && (
                      <span className="border-success/40 text-success rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                        Maior retorno
                      </span>
                    )}
                  </div>
                  <span className="text-text-muted font-mono text-xs">{tier.pct} de volta</span>
                </div>

                {/* Team list */}
                <div className="grid grid-cols-2 gap-px bg-border p-px sm:grid-cols-3">
                  {tier.selecoes.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center gap-3 bg-bg-elevated px-3.5 py-3"
                    >
                      <BandeiraImg emoji={s.emoji} nome={s.name} size={24} />
                      <span className="text-sm font-semibold">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
