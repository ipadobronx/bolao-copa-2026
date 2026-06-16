import { JogoResumoCard } from './JogoResumoCard'
import type { JogoResumo } from '@/lib/dashboard/resumo-jogo'

export function PalpitesDoJogoPanel({
  atual,
  proximo,
}: {
  atual: JogoResumo | null
  proximo: JogoResumo | null
}) {
  if (!atual && !proximo) return null
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">
        ⚽ Palpites do jogo
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {atual && <JogoResumoCard jogo={atual} proximo={false} />}
        {proximo && <JogoResumoCard jogo={proximo} proximo={true} />}
      </div>
    </div>
  )
}
