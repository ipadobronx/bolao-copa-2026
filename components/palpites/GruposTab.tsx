'use client';

import { useState } from 'react';
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
  const [activeGrupo, setActiveGrupo] = useState(grupos[0] ?? 'A');

  const jogosGrupo = byGrupo.get(activeGrupo) ?? [];

  return (
    <div>
      <GrupoNav grupos={grupos} activeGrupo={activeGrupo} onSelect={setActiveGrupo} />
      <GroupSection
        bilheteId={bilheteId}
        grupo={activeGrupo}
        jogos={jogosGrupo}
        palpitesSalvos={palpitesSalvos}
      />
    </div>
  );
}
