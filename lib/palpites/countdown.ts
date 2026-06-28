export type CountdownState = 'normal' | 'urgent' | 'closed'

/** Abaixo deste tempo restante, a contagem entra em modo "urgente" (laranja). */
export const URGENT_THRESHOLD_MS = 24 * 3600 * 1000

export function countdownState(ms: number): CountdownState {
  if (ms <= 0) return 'closed'
  if (ms <= URGENT_THRESHOLD_MS) return 'urgent'
  return 'normal'
}

/** Quebra um intervalo (ms) em horas/minutos/segundos com zero-pad. Clampa negativos. */
export function formatCountdown(ms: number): { h: string; m: string; s: string } {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return { h: pad(h), m: pad(m), s: pad(s) }
}
