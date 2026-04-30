import Link from 'next/link';

type FlagRowData = {
  flag: string;
  name: string;
  vagas: string;
  selected: boolean;
};

// Conteúdo demonstrativo até a Feature 6 (checkout) ligar dados reais
// — vagas restantes virão de COUNT(bilhetes WHERE selecao_cashback_id = X).
const FLAGS: FlagRowData[] = [
  { flag: '🇧🇷', name: 'Brasil', vagas: '12/20 vagas restantes', selected: true },
  { flag: '🇦🇷', name: 'Argentina', vagas: '8/20 vagas restantes', selected: false },
  { flag: '🇫🇷', name: 'França', vagas: '15/20 vagas restantes', selected: false },
  { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'Inglaterra', vagas: '19/20 vagas restantes', selected: false },
];

const promoBackground = {
  background: `
    linear-gradient(135deg, rgba(250, 204, 21, 0.08), rgba(0, 151, 57, 0.05)),
    var(--color-bg-dark)
  `,
};

export function PromoSection() {
  return (
    <section id="cashback" className="border-border border-y py-20" style={promoBackground}>
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 md:grid-cols-2">
        <div>
          <span className="bg-brasil mb-4 inline-block rounded px-3 py-1 font-mono text-[11px] font-bold tracking-[1px] text-white uppercase">
            🎁 Promoção Cashback
          </span>
          <h2 className="font-display mb-4 text-[64px] leading-[0.95]">
            Comprou <span className="text-accent">R$ 100+</span>
            <br />
            Escolheu campeão?
            <br />
            <span className="text-accent">Dinheiro de volta.</span>
          </h2>
          <p className="text-text-secondary mb-6 text-base leading-relaxed">
            Compre 5 tabelas ou mais (R$ 100+) e escolha uma seleção. Se ela for campeã da Copa,
            você recebe 100% do valor pago de volta no PIX. Limite de 20 apostadores por seleção —
            primeiro chegou, levou.
          </p>
          <Link href="/comprar" className="btn-primary btn-hero">
            Garantir meu cashback →
          </Link>
        </div>
        <div className="bg-bg-card border-border-strong rounded-2xl border p-8">
          <div className="space-y-3">
            {FLAGS.map((flag) => (
              <div
                key={flag.name}
                className={flag.selected ? 'flag-row flag-row-selected' : 'flag-row'}
              >
                <span aria-hidden="true" className="text-[32px] leading-none">
                  {flag.flag}
                </span>
                <div className="flex-1">
                  <div className="text-[15px] font-bold">{flag.name}</div>
                  <div className="text-text-muted font-mono text-xs">{flag.vagas}</div>
                </div>
                {flag.selected && (
                  <span className="bg-accent text-bg-dark rounded px-2.5 py-1 font-mono text-[11px] font-bold">
                    SUA ESCOLHA
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
