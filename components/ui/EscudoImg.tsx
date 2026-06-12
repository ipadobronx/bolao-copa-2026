const ESCUDOS: Record<string, { nome: string; file: string }> = {
  nautico: { nome: 'Náutico', file: 'nautico.png' },
  corinthians: { nome: 'Corinthians', file: 'corinthians.png' },
}

export function EscudoImg({ slug, size = 20 }: { slug: string | null | undefined; size?: number }) {
  const escudo = slug ? ESCUDOS[slug] : undefined
  if (!escudo) return null
  // PNGs transparentes; tamanho fixo (size×size) + object-contain mantém todos
  // os escudos do mesmo tamanho, sem fundo.
  return (
    <img
      src={`/escudos/${escudo.file}`}
      alt={escudo.nome}
      title={escudo.nome}
      width={size}
      height={size}
      className="ml-1 inline-block shrink-0 object-contain align-middle"
    />
  )
}
