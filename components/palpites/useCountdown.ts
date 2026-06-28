'use client'

import { useEffect, useState } from 'react'
import { countdownState, formatCountdown, type CountdownState } from '@/lib/palpites/countdown'

export type Countdown = {
  remainingMs: number
  state: CountdownState
  parts: { h: string; m: string; s: string }
}

/** Conta o tempo restante até `deadline` (ISO), atualizando a cada 1s. */
export function useCountdown(deadline: string): Countdown {
  const [remainingMs, setRemainingMs] = useState(() => new Date(deadline).getTime() - Date.now())

  useEffect(() => {
    const diff = () => new Date(deadline).getTime() - Date.now()
    setRemainingMs(diff())
    const id = setInterval(() => {
      const ms = diff()
      setRemainingMs(ms)
      if (ms <= 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [deadline])

  return { remainingMs, state: countdownState(remainingMs), parts: formatCountdown(remainingMs) }
}
