const ESCUDOS: Record<string, { nome: string; file: string }> = {
  nautico: { nome: 'Náutico', file: 'nautico.png' },
  corinthians: { nome: 'Corinthians', file: 'corinthians.jpg' },
}

export function EscudoImg({ slug, size = 18 }: { slug: string | null | undefined; size?: number }) {
  const escudo = slug ? ESCUDOS[slug] : undefined
  if (!escudo) return null
  return (
    <img
      src={`/escudos/${escudo.file}`}
      alt={escudo.nome}
      title={escudo.nome}
      width={size}
      height={size}
      className="inline-block shrink-0 object-contain align-middle"
    />
  )
}
