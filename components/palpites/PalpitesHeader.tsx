type Props = {
  numeroBilhete: number;
  palpitesCount: number;
  primeiroJogoDataHora: string;
};

const TOTAL = 104;

export function PalpitesHeader({ numeroBilhete, palpitesCount, primeiroJogoDataHora }: Props) {
  const deadline = new Date(primeiroJogoDataHora);
  const dateStr = deadline.toLocaleDateString('pt-BR');
  const timeStr = deadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl">
          Meus <span className="text-accent">palpites</span>
        </h1>
        <p className="font-mono text-text-muted mt-1 text-[12px]">
          Tabela #{numeroBilhete} · Copa até {dateStr} às {timeStr}
        </p>
      </div>
      <div className="text-right">
        <div className="font-mono text-accent text-[22px] font-bold leading-none">
          {palpitesCount}
          <span className="text-text-muted text-sm font-normal">/{TOTAL}</span>
        </div>
        <div className="text-text-muted text-[11px]">preenchidos</div>
      </div>
    </div>
  );
}
