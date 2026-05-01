const GRADIENTS = [
  'linear-gradient(135deg,#22d3ee,#0ea5e9)',
  'linear-gradient(135deg,#f472b6,#ec4899)',
  'linear-gradient(135deg,#a78bfa,#8b5cf6)',
  'linear-gradient(135deg,#34d399,#10b981)',
  'linear-gradient(135deg,#60a5fa,#3b82f6)',
  'linear-gradient(135deg,#fb923c,#f97316)',
  'linear-gradient(135deg,#facc15,#f59e0b)',
  'linear-gradient(135deg,#f87171,#ef4444)',
] as const

export function avatarColor(userId: string): string {
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[hash % GRADIENTS.length]
}

export function avatarInitials(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
