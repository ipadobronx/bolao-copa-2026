type Feature = {
  emoji: string;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    emoji: '💳',
    title: 'Compre sua tabela',
    description:
      'R$ 20 por tabela via PIX. Quanto mais tabelas, mais chances. Confirmação na hora no WhatsApp.',
  },
  {
    emoji: '⚽',
    title: 'Palpite nos 104 jogos',
    description:
      'Fase de grupos e mata-mata. Escolha campeão, vice, artilheiro e mais bônus especiais.',
  },
  {
    emoji: '📊',
    title: 'Pontue em tempo real',
    description:
      'Placar exato vale 10 pts. Vencedor vale 5. Mata-mata multiplica. Ranking atualiza automático.',
  },
  {
    emoji: '💰',
    title: 'Receba no PIX',
    description: 'Terminou a Copa? Top 10 recebe o prêmio direto na conta em até 48h após a final.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-bg-card py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="font-display mb-3 text-center text-[56px] tracking-[-0.5px]">
          Como <span className="text-accent">funciona</span>
        </h2>
        <p className="text-text-secondary mb-14 text-center text-base">
          Simples, transparente e ao vivo. Você palpita, o sistema calcula, o placar sobe.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature-card">
              <span
                aria-hidden="true"
                className="bg-accent/15 mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-[22px]"
              >
                {feature.emoji}
              </span>
              <h3 className="mb-2 text-lg font-bold">{feature.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
