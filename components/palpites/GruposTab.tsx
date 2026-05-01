import { GroupSection } from './GroupSection';
import { groupGamesByGrupo } from '@/lib/palpites';
import type { JogoComSelecoes, PalpiteSalvo } from '@/lib/palpites';

type Props = {
  bilheteId: string;
  jogos: JogoComSelecoes[];
  palpitesSalvos: PalpiteSalvo[];
};

export function GruposTab({ bilheteId, jogos, palpitesSalvos }: Props) {
  const byGrupo = groupGamesByGrupo(jogos);

  return (
    <div>
      {[...byGrupo.entries()].map(([grupo, jogosGrupo]) => (
        <GroupSection
          key={grupo}
          bilheteId={bilheteId}
          grupo={grupo}
          jogos={jogosGrupo}
          palpitesSalvos={palpitesSalvos}
        />
      ))}
    </div>
  );
}
