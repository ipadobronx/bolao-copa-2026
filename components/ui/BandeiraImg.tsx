// Converts a flag emoji (2 regional-indicator codepoints) to a flagcdn.com PNG.
// Falls back to 🏆 for placeholders, artilheiro, or unknown emoji.
function emojiToISO2(emoji: string): string | null {
  const points = [...emoji].map((c) => c.codePointAt(0)!)
  if (points.length !== 2 || points[0]! < 0x1f1e6 || points[0]! > 0x1f1ff) return null
  return points.map((p) => String.fromCharCode(p - 0x1f1e6 + 65)).join('').toLowerCase()
}

export function BandeiraImg({
  emoji,
  nome,
  size = 28,
  className,
}: {
  emoji: string | null | undefined
  nome: string
  size?: number
  className?: string
}) {
  const iso2 = emoji ? emojiToISO2(emoji) : null
  if (!iso2) {
    return (
      <span aria-hidden="true" style={{ fontSize: size }}>
        🏆
      </span>
    )
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${iso2}.png`}
      alt={nome}
      width={size}
      height={Math.round(size * 0.75)}
      className={['rounded-sm object-cover', className].filter(Boolean).join(' ')}
    />
  )
}
