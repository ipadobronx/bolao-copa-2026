const ESCUDOS: Record<string, string> = {
  nautico: 'Náutico',
  corinthians: 'Corinthians',
}

export function EscudoImg({ slug, size = 18 }: { slug: string | null | undefined; size?: number }) {
  if (!slug || !(slug in ESCUDOS)) return null
  return (
    <img
      src={`/escudos/${slug}.svg`}
      alt={ESCUDOS[slug]}
      title={ESCUDOS[slug]}
      width={size}
      height={size}
      className="inline-block shrink-0 align-middle"
    />
  )
}
