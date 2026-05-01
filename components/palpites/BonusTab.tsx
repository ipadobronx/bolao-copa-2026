import { BonusCard } from './BonusCard';
import type { BonusSalvo, SelecaoBasica, TipoBonus } from '@/lib/palpites';

const BONUS_ORDER: TipoBonus[] = [
  'campeao',
  'vice',
  'terceiro',
  'quarto',
  'artilheiro',
  'revelacao',
];

type Props = {
  bilheteId: string;
  selecoes: SelecaoBasica[];
  bonusSalvos: BonusSalvo[];
  primeiroJogoDataHora: string;
};

export function BonusTab({ bilheteId, selecoes, bonusSalvos, primeiroJogoDataHora }: Props) {
  const deadlinePassed = new Date(primeiroJogoDataHora) <= new Date();
  const salvoMap = new Map(bonusSalvos.map((b) => [b.tipo, b]));

  const deadlineDate = new Date(primeiroJogoDataHora);
  const dateStr = deadlineDate.toLocaleDateString('pt-BR');
  const timeStr = deadlineDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="mb-5">
        <h2 className="font-display text-3xl">
          Palpites de <span className="text-accent">Bônus</span>
        </h2>
        <p className="font-mono text-text-muted mt-1 text-[12px]">
          {deadlinePassed
            ? '🔒 Prazo encerrado — bônus salvos até o início da Copa'
            : `Prazo: antes de ${dateStr} às ${timeStr}`}
        </p>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BONUS_ORDER.slice(0, 4).map((tipo) => (
          <BonusCard
            key={tipo}
            bilheteId={bilheteId}
            tipo={tipo}
            selecoes={selecoes}
            bonusSalvo={salvoMap.get(tipo) ?? null}
            deadlinePassed={deadlinePassed}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BONUS_ORDER.slice(4).map((tipo) => (
          <BonusCard
            key={tipo}
            bilheteId={bilheteId}
            tipo={tipo}
            selecoes={selecoes}
            bonusSalvo={salvoMap.get(tipo) ?? null}
            deadlinePassed={deadlinePassed}
          />
        ))}
      </div>
    </div>
  );
}
