import { PodioCard } from './PodioCard'

export type PodioEntry = {
  userId: string
  nome: string
  posicao: number
  pontosTotais: number
  totalBilhetes: number
  isCurrentUser: boolean
}

export function PodioSection({ entries }: { entries: PodioEntry[] }) {
  if (entries.length === 0) return null
  // Ordem visual: 2° à esquerda, 1° ao centro, 3° à direita
  const ordered = ([entries[1], entries[0], entries[2]] as (PodioEntry | undefined)[])
    .filter((e): e is PodioEntry => e !== undefined)
  return (
    <div className="podio-section">
      {ordered.map((e) => (
        <PodioCard key={e.userId} entry={e} />
      ))}
    </div>
  )
}
