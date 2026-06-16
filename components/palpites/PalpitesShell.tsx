'use client';

import { useEffect, useMemo, useState } from 'react';
import { GruposTab } from './GruposTab';
import { FaseTab } from './FaseTab';
import { BonusTab } from './BonusTab';
import { PalpitesHeader } from './PalpitesHeader';
import { PalpitesTabs, type TabKey } from './PalpitesTabs';
import { abaInicial } from '@/lib/palpites';
import type {
  BilheteResumo,
  BonusSalvo,
  FaseJogo,
  JogoComSelecoes,
  PalpiteSalvo,
  SelecaoBasica,
} from '@/lib/palpites';

type Props = {
  bilhete: BilheteResumo;
  jogos: JogoComSelecoes[];
  palpitesSalvos: PalpiteSalvo[];
  bonusSalvos: BonusSalvo[];
  selecoes: SelecaoBasica[];
  initialTab?: string | null;
  targetJogoId?: number | null;
};

const FASE_TABS: FaseJogo[] = [
  '16avos',
  'oitavas',
  'quartas',
  'semis',
  'disputa_terceiro',
  'final',
];

export function PalpitesShell({
  bilhete,
  jogos,
  palpitesSalvos,
  bonusSalvos,
  selecoes,
  initialTab,
  targetJogoId,
}: Props) {
  const targetJogo = targetJogoId != null ? jogos.find((j) => j.id === targetJogoId) ?? null : null;
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    abaInicial(targetJogo?.fase ?? null, initialTab ?? null),
  );

  useEffect(() => {
    if (targetJogoId == null) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`jogo-${targetJogoId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('jogo-destacado');
      }
    }, 150);
    return () => clearTimeout(t);
  }, [targetJogoId]);

  const primeiroJogoDataHora = useMemo(
    () =>
      jogos.reduce(
        (min, j) => (j.data_hora < min ? j.data_hora : min),
        jogos[0]?.data_hora ?? new Date().toISOString(),
      ),
    [jogos],
  );

  return (
    <div className="p-4 sm:p-6">
      <PalpitesHeader
        numeroBilhete={bilhete.numero_bilhete}
        palpitesCount={palpitesSalvos.length}
        primeiroJogoDataHora={primeiroJogoDataHora}
      />

      <PalpitesTabs activeTab={activeTab} onChange={setActiveTab} />

      <div style={{ display: activeTab === 'grupos' ? 'block' : 'none' }}>
        <GruposTab
          bilheteId={bilhete.id}
          jogos={jogos}
          palpitesSalvos={palpitesSalvos}
          targetJogoId={targetJogoId ?? null}
        />
      </div>

      {FASE_TABS.map((fase) => (
        <div key={fase} style={{ display: activeTab === fase ? 'block' : 'none' }}>
          <FaseTab
            bilheteId={bilhete.id}
            fase={fase}
            jogos={jogos}
            palpitesSalvos={palpitesSalvos}
          />
        </div>
      ))}

      <div style={{ display: activeTab === 'bonus' ? 'block' : 'none' }}>
        <BonusTab
          bilheteId={bilhete.id}
          selecoes={selecoes}
          bonusSalvos={bonusSalvos}
          primeiroJogoDataHora={primeiroJogoDataHora}
        />
      </div>
    </div>
  );
}
