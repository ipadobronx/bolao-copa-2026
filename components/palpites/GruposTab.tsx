import { GroupSection } from './GroupSection';
import { GrupoNav } from './GrupoNav';
import { groupGamesByGrupo } from '@/lib/palpites';
import type { JogoComSelecoes, PalpiteSalvo } from '@/lib/palpites';

type Props = {
  bilheteId: string;
  jogos: JogoComSelecoes[];
  palpitesSalvos: PalpiteSalvo[];
};

export function GruposTab({ bilheteId, jogos, palpitesSalvos }: Props) {
  const byGrupo = groupGamesByGrupo(jogos);
  const grupos = [...byGrupo.keys()];

  return (
    <div>
      <GrupoNav grupos={grupos} />
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
