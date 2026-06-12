const ESCUDOS: Record<string, { nome: string; file: string }> = {
  nautico: { nome: 'Náutico', file: 'nautico.png' },
  corinthians: { nome: 'Corinthians', file: 'corinthians.jpg' },
}

export function EscudoImg({ slug, size = 20 }: { slug: string | null | undefined; size?: number }) {
  const escudo = slug ? ESCUDOS[slug] : undefined
  if (!escudo) return null
  // Chip branco redondo de tamanho fixo: uniformiza tamanho entre clubes e faz
  // o fundo (branco) das imagens não-transparentes parecer proposital.
  return (
    <span
      className="ml-1 inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white align-middle ring-1 ring-black/10"
      style={{ width: size, height: size }}
      title={escudo.nome}
    >
      <img
        src={`/escudos/${escudo.file}`}
        alt={escudo.nome}
        className="h-full w-full object-contain p-px"
      />
    </span>
  )
}
