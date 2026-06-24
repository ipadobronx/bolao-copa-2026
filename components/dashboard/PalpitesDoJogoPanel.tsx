import { JogoResumoCard } from './JogoResumoCard'
import type { JogoResumo } from '@/lib/dashboard/resumo-jogo'

export function PalpitesDoJogoPanel({
  atuais,
  proximos,
}: {
  atuais: JogoResumo[]
  proximos: JogoResumo[]
}) {
  if (atuais.length === 0 && proximos.length === 0) return null
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">
        ⚽ Palpites do jogo
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {atuais.map((j) => (
          <JogoResumoCard key={j.numeroJogo} jogo={j} proximo={false} />
        ))}
        {proximos.map((j) => (
          <JogoResumoCard key={j.numeroJogo} jogo={j} proximo={true} />
        ))}
      </div>
    </div>
  )
}
