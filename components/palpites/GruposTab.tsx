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
  targetJogoId?: number | null;
};

export function GruposTab({ bilheteId, jogos, palpitesSalvos, targetJogoId }: Props) {
  const byGrupo = groupGamesByGrupo(jogos);
  const grupos = [...byGrupo.keys()];
  const grupoAlvo =
    targetJogoId != null
      ? grupos.find((g) => (byGrupo.get(g) ?? []).some((j) => j.id === targetJogoId))
      : undefined;
  const [activeGrupo, setActiveGrupo] = useState(grupoAlvo ?? grupos[0] ?? 'A');

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
