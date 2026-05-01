import { RodadaHeader } from './RodadaHeader';
import { MatchRow } from './MatchRow';
import type { Rodada, PalpiteSalvo } from '@/lib/palpites';

type Props = {
  bilheteId: string;
  rodada: Rodada;
  palpitesSalvos: PalpiteSalvo[];
};

export function RodadaSection({ bilheteId, rodada, palpitesSalvos }: Props) {
  const salvoMap = new Map(palpitesSalvos.map((p) => [p.jogo_id, p]));

  return (
    <div className="mt-3.5">
      <RodadaHeader numero={rodada.numero} deadline={rodada.deadline} />
      {rodada.jogos.map((jogo) => (
        <MatchRow
          key={jogo.id}
          bilheteId={bilheteId}
          jogo={jogo}
          palpiteSalvo={salvoMap.get(jogo.id) ?? null}
        />
      ))}
    </div>
  );
}
