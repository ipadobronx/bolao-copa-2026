export function formatDiasHoras(de: Date, ate: Date): { dias: number; horas: number } {
  const ms = +ate - +de
  if (ms <= 0) return { dias: 0, horas: 0 }
  const horasTotal = Math.floor(ms / (1000 * 60 * 60))
  return { dias: Math.floor(horasTotal / 24), horas: horasTotal % 24 }
}
