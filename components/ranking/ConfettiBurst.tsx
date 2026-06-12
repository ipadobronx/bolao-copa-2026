'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

/** Dispara um confete sutil 1x. `triggerKey` muda → dispara de novo (ex.: pódio mudou). */
export function ConfettiBurst({ triggerKey }: { triggerKey: string }) {
  useEffect(() => {
    const id = window.setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 70,
        startVelocity: 38,
        origin: { y: 0.35 },
        colors: ['#facc15', '#ffffff', '#22c55e'],
        disableForReducedMotion: true,
      })
    }, 250)
    return () => window.clearTimeout(id)
  }, [triggerKey])
  return null
}
