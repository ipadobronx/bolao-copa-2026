export function tempoAtras(data: Date | string, agora: Date = new Date()): string {
  const ms = agora.getTime() - new Date(data).getTime()
  if (ms < 0) return 'agora'
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'dia' : 'dias'}`
}
