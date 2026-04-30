import Link from 'next/link';

const heroBackground = {
  background: `
    radial-gradient(ellipse at top right, rgba(250, 204, 21, 0.15), transparent 50%),
    radial-gradient(ellipse at bottom left, rgba(0, 151, 57, 0.12), transparent 50%),
    var(--color-bg-dark)
  `,
};

const gridOverlay = {
  backgroundImage: `
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
  `,
  backgroundSize: '40px 40px',
};

const prizeCardBackground = {
  background: 'linear-gradient(145deg, var(--color-bg-elevated), var(--color-bg-card))',
};

const prizeCardOverlay = {
  background: 'radial-gradient(circle, rgba(250, 204, 21, 0.08), transparent 60%)',
};

export function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden pt-20 pb-30" style={heroBackground}>
      <div
        className="pointer-events-none absolute inset-0"
        style={gridOverlay}
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto max-w-[1200px] px-6">
        <div className="grid grid-cols-1 items-center gap-20 md:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="border-accent/30 bg-accent/10 text-accent mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-xs font-semibold tracking-[1px] uppercase">
              <span
                aria-hidden="true"
                className="bg-accent animate-pulse-dot h-1.5 w-1.5 rounded-full"
              />
              Copa do Mundo · EUA · México · Canadá
            </div>
            <h1 className="font-display mb-6 text-[clamp(48px,8vw,96px)] leading-[0.9] tracking-[-1px]">
              <span className="text-text-primary block">Palpite.</span>
              <span className="text-accent block">Pontue.</span>
              <span className="font-body text-text-primary mt-3 block text-[0.5em] font-extrabold tracking-normal uppercase">
                Leve R$ 10 mil pra casa.
              </span>
            </h1>
            <p className="text-text-secondary mb-8 max-w-[520px] text-lg leading-relaxed">
              O bolão mais justo da Copa 2026. 104 jogos, pontuação ao vivo, ranking em tempo real.
              R$ 20 a tabela. Comprou 5, escolhe uma seleção — se ela for campeã, você leva 100% de
              volta.
            </p>
            <div className="mb-12 flex flex-wrap gap-3">
              <Link href="/comprar" className="btn-primary btn-hero">
                Comprar minha tabela →
              </Link>
              <a href="#features" className="btn-secondary btn-hero">
                Ver regras
              </a>
            </div>
            <div className="border-border grid grid-cols-3 gap-6 border-t pt-8">
              <div>
                <div className="font-display text-accent text-4xl leading-none">R$ 10K</div>
                <div className="text-text-muted mt-1 font-mono text-xs tracking-[1px] uppercase">
                  Prêmio total
                </div>
              </div>
              <div>
                <div className="font-display text-accent text-4xl leading-none">104</div>
                <div className="text-text-muted mt-1 font-mono text-xs tracking-[1px] uppercase">
                  Jogos
                </div>
              </div>
              <div>
                <div className="font-display text-accent text-4xl leading-none">48</div>
                <div className="text-text-muted mt-1 font-mono text-xs tracking-[1px] uppercase">
                  Seleções
                </div>
              </div>
            </div>
          </div>

          <div
            className="border-border-strong relative overflow-hidden rounded-[20px] border p-8"
            style={prizeCardBackground}
          >
            <div
              className="pointer-events-none absolute -top-1/2 -right-1/2 h-[200%] w-[200%]"
              style={prizeCardOverlay}
              aria-hidden="true"
            />
            <div className="relative mb-6 flex items-center justify-between">
              <span className="text-text-muted font-mono text-[11px] tracking-[1px] uppercase">
                Distribuição do Prêmio
              </span>
              <span
                aria-hidden="true"
                className="bg-accent flex h-10 w-10 items-center justify-center rounded-[10px] text-xl"
              >
                🏆
              </span>
            </div>
            <div className="font-display text-accent relative text-7xl leading-none">
              <span className="mr-1 align-top text-4xl">R$</span>10.000
            </div>
            <p className="text-text-secondary relative mt-1 mb-8 text-sm">
              dividido entre os 10 primeiros colocados
            </p>
            <div className="relative space-y-3">
              <div className="flex items-center justify-between rounded-[10px] border-l-[3px] border-l-[#FFD700] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="bg-bg-elevated flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold">
                    1º
                  </span>
                  <span>Campeão</span>
                </div>
                <span className="text-accent font-mono font-bold">R$ 5.000</span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border-l-[3px] border-l-[#C0C0C0] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="bg-bg-elevated flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold">
                    2º
                  </span>
                  <span>Vice</span>
                </div>
                <span className="text-accent font-mono font-bold">R$ 2.500</span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border-l-[3px] border-l-[#CD7F32] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="bg-bg-elevated flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold">
                    3º
                  </span>
                  <span>Terceiro</span>
                </div>
                <span className="text-accent font-mono font-bold">R$ 1.500</span>
              </div>
              <div className="border-l-border-strong flex items-center justify-between rounded-[10px] border-l-[3px] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="bg-bg-elevated flex h-6 w-6 items-center justify-center rounded-md font-mono text-[10px] font-bold">
                    4-10
                  </span>
                  <span>Top 10</span>
                </div>
                <span className="text-accent font-mono font-bold">R$ 1.000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
