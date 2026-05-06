'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { Globe } from 'cobe'

const YELLOW: [number, number, number] = [0.98, 0.80, 0.08]
const GREEN:  [number, number, number] = [0.0,  0.6,  0.3]
const BLUE:   [number, number, number] = [0.2,  0.4,  0.9]
const RED:    [number, number, number] = [0.85, 0.1,  0.2]

type Flag = {
  id: string
  location: [number, number]   // lat, lng
  flagIso: string
  name: string
  isHost: boolean
  tier?: 1 | 2 | 3 | 5
  color: [number, number, number]
  size: number
}

type EmojiAnchor = {
  id: string
  location: [number, number]
  emoji: string
  shadow: string
  ariaLabel: string
}

const FLAGS: Flag[] = [
  // 3 sedes — América do Norte (perto dos arcs)
  { id: 'mex', location: [20,  -100], flagIso: 'mx', name: 'México', isHost: true,  color: GREEN, size: 0.05 },
  { id: 'usa', location: [40,   -90], flagIso: 'us', name: 'EUA',    isHost: true,  color: BLUE,  size: 0.05 },
  { id: 'can', location: [55,  -100], flagIso: 'ca', name: 'Canadá', isHost: true,  color: RED,   size: 0.05 },

  // 4 América do Sul
  { id: 'col', location: [5,    -75], flagIso: 'co',     name: 'Colômbia',   isHost: false, tier: 5, color: YELLOW, size: 0.025 },
  { id: 'bra', location: [-15,  -50], flagIso: 'br',     name: 'Brasil',     isHost: false, tier: 2, color: YELLOW, size: 0.025 },
  { id: 'arg', location: [-35,  -65], flagIso: 'ar',     name: 'Argentina',  isHost: false, tier: 2, color: YELLOW, size: 0.025 },
  { id: 'uru', location: [-30,  -55], flagIso: 'uy',     name: 'Uruguai',    isHost: false, tier: 5, color: YELLOW, size: 0.025 },

  // 9 europeias redistribuídas pelo globo todo (ignora geografia real, preenche vazios)
  { id: 'eng', location: [55,    10], flagIso: 'gb-eng', name: 'Inglaterra', isHost: false, tier: 1, color: YELLOW, size: 0.025 }, // Norte Europa (única na região)
  { id: 'nor', location: [65,    80], flagIso: 'no',     name: 'Noruega',    isHost: false, tier: 5, color: YELLOW, size: 0.025 }, // Sibéria
  { id: 'ned', location: [40,   110], flagIso: 'nl',     name: 'Holanda',    isHost: false, tier: 3, color: YELLOW, size: 0.025 }, // China / Mongólia
  { id: 'bel', location: [15,    80], flagIso: 'be',     name: 'Bélgica',    isHost: false, tier: 5, color: YELLOW, size: 0.025 }, // Índia
  { id: 'ger', location: [30,    50], flagIso: 'de',     name: 'Alemanha',   isHost: false, tier: 3, color: YELLOW, size: 0.025 }, // Oriente Médio / Arábia
  { id: 'fra', location: [20,    20], flagIso: 'fr',     name: 'França',     isHost: false, tier: 1, color: YELLOW, size: 0.025 }, // Norte África / Mediterrâneo
  { id: 'esp', location: [0,    -10], flagIso: 'es',     name: 'Espanha',    isHost: false, tier: 1, color: YELLOW, size: 0.025 }, // África Equatorial
  { id: 'sui', location: [-25,   30], flagIso: 'ch',     name: 'Suíça',      isHost: false, tier: 5, color: YELLOW, size: 0.025 }, // África Sul
  { id: 'por', location: [-30,    0], flagIso: 'pt',     name: 'Portugal',   isHost: false, tier: 3, color: YELLOW, size: 0.025 }, // Atlântico Sul (off África Sul-Oeste)
]

const EMOJIS: EmojiAnchor[] = [
  { id: 'mala',  location: [35,  -40], emoji: '🧳', shadow: 'rgba(250,204,21,0.4)', ariaLabel: 'Mala — Copa 2026' },
  { id: 'tacaa', location: [-25, 100], emoji: '🏆', shadow: 'rgba(250,204,21,0.6)', ariaLabel: 'Taça da Copa do Mundo' },
]

const ARCS = [
  // verde (MEX) → azul (USA)
  { from: [20, -100] as [number, number], to: [40, -90]  as [number, number], color: [0.10, 0.55, 0.55] as [number, number, number] },
  // azul (USA) → vermelho (CAN)
  { from: [40,  -90] as [number, number], to: [55, -100] as [number, number], color: [0.55, 0.25, 0.55] as [number, number, number] },
]

function isWeakDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const cpus = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  return cpus < 4 || mem < 2
}

/**
 * Project a lat/lng on a unit sphere to canvas screen coords given the
 * current globe rotation (phi around Y, theta around X).
 *
 * Returns z so callers can compute opacity for the "behind the globe" fade.
 * z > 0 → on the camera-facing hemisphere; z ≤ 0 → behind globe.
 */
function project(latDeg: number, lngDeg: number, phi: number, theta: number, size: number) {
  const lat = (latDeg * Math.PI) / 180
  const lng = (lngDeg * Math.PI) / 180

  // 3D point on unit sphere — cobe convention (Y up, +Z toward camera at phi=0)
  const x0 = Math.cos(lat) * Math.sin(lng)
  const y0 = Math.sin(lat)
  const z0 = Math.cos(lat) * Math.cos(lng)

  // Rotate around Y by phi (matches cobe's auto-rotation direction)
  const cp = Math.cos(phi), sp = Math.sin(phi)
  const x1 = x0 * cp + z0 * sp
  const z1 = -x0 * sp + z0 * cp

  // Tilt around X by theta
  const ct = Math.cos(theta), st = Math.sin(theta)
  const y2 = y0 * ct - z1 * st
  const z2 = y0 * st + z1 * ct

  const r = size / 2
  return { x: r + x1 * r, y: r - y2 * r, z: z2 }
}

function GlobeFallbackStatic() {
  const cashback = FLAGS.filter((f) => !f.isHost)
  const hosts = FLAGS.filter((f) => f.isHost)
  return (
    <div className="w-full rounded-2xl border border-border bg-bg-elevated p-6">
      <div className="mb-4 flex items-center justify-center gap-3">
        {hosts.map((h, i) => (
          <div key={h.id} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <img
                src={`https://flagcdn.com/w40/${h.flagIso}.png`}
                alt={h.name}
                width={28}
                height={21}
                className="rounded-sm object-cover"
              />
              <span className="font-mono text-[9px] text-text-muted">{h.name}</span>
            </div>
            {i < hosts.length - 1 && <span className="text-xs text-text-muted">→</span>}
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-4">
        <p className="mb-2 text-center font-mono text-[9px] uppercase tracking-widest text-text-muted">
          13 seleções elegíveis ao cashback
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {cashback.map((m) => (
            <img
              key={m.id}
              src={`https://flagcdn.com/w40/${m.flagIso}.png`}
              alt={m.name}
              width={20}
              height={15}
              title={`${m.name} ${m.tier}×`}
              className="rounded-sm object-cover"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function GlobeCashback({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const globeRef = useRef<Globe | null>(null)
  const animIdRef = useRef(0)
  const [canvasReady, setCanvasReady] = useState(false)
  const [isWeak, setIsWeak] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    if (isWeakDevice()) {
      setIsWeak(true)
      return
    }

    const mobile = window.innerWidth < 768
    setIsMobile(mobile)

    const speed = mobile ? 0.002 : 0.003
    const dpr = mobile ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    const samples = mobile ? 8000 : 16000

    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })

    let cancelled = false
    let phi = 1.2

    import('cobe').then(({ default: createGlobe }) => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return

      function init() {
        const width = canvas!.offsetWidth
        if (width === 0 || globeRef.current) return

        globeRef.current = createGlobe(canvas!, {
          devicePixelRatio: dpr,
          width,
          height: width,
          phi: 1.2,
          theta: 0.1,
          dark: 0,
          diffuse: 1.2,
          mapSamples: samples,
          mapBrightness: 6,
          baseColor: [0.15, 0.18, 0.25],
          markerColor: YELLOW,
          glowColor: [0.05, 0.06, 0.10],
          // marcadores ON the surface (não flutuando fora)
          markerElevation: 0.05,
          markers: FLAGS.map((m) => ({
            location: m.location,
            size: m.size,
            color: m.color,
          })),
          arcs: ARCS,
          arcWidth: 1.0,
          arcHeight: 0.4,
          opacity: 0.9,
        })

        function animate() {
          if (cancelled) return
          if (!isPausedRef.current) phi += speed

          const currentPhi = phi + phiOffsetRef.current + dragOffset.current.phi
          const currentTheta = 0.1 + thetaOffsetRef.current + dragOffset.current.theta

          globeRef.current!.update({ phi: currentPhi, theta: currentTheta })

          // Sync flag/emoji overlays with globe rotation
          const w = canvas!.offsetWidth
          if (w > 0) {
            for (const item of FLAGS) {
              const p = project(item.location[0], item.location[1], currentPhi, currentTheta, w)
              const el = overlayRefs.current[item.id]
              if (el) {
                // Smooth fade as the marker approaches the silhouette (z ≈ 0)
                const fade = Math.max(0, Math.min(1, p.z * 5 - 0.15))
                el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`
                el.style.opacity = fade.toFixed(2)
              }
            }
            for (const item of EMOJIS) {
              const p = project(item.location[0], item.location[1], currentPhi, currentTheta, w)
              const el = overlayRefs.current[item.id]
              if (el) {
                const fade = Math.max(0, Math.min(1, p.z * 5 - 0.15))
                el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`
                el.style.opacity = fade.toFixed(2)
              }
            }
          }

          animIdRef.current = requestAnimationFrame(animate)
        }
        animate()
        setTimeout(() => {
          if (canvas && !cancelled) {
            canvas.style.opacity = '1'
            setCanvasReady(true)
          }
        })
      }

      if (canvas.offsetWidth > 0) {
        init()
      } else {
        const ro = new ResizeObserver((entries) => {
          if ((entries[0]?.contentRect.width ?? 0) > 0) {
            ro.disconnect()
            init()
          }
        })
        ro.observe(canvas)
      }
    })

    return () => {
      cancelled = true
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current)
      globeRef.current?.destroy()
      globeRef.current = null
    }
  }, [handlePointerUp])

  if (isWeak) return <GlobeFallbackStatic />

  const flagW = isMobile ? 22 : 28
  const flagH = isMobile ? 16 : 20
  const emojiSize = isMobile ? 28 : 36

  return (
    <div className={`select-none ${className}`}>
      <div className="relative mx-auto w-full" style={{ maxWidth: '460px' }}>
        <div className="relative aspect-square">
          {!canvasReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )}

          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            style={{
              width: '100%',
              height: '100%',
              cursor: 'grab',
              opacity: 0,
              transition: 'opacity 1.2s ease',
              touchAction: 'none',
              display: 'block',
            }}
          />

          {/* Overlay layer — flags and emojis projected each frame to follow globe rotation */}
          <div className="pointer-events-none absolute inset-0">
            {FLAGS.map((f) => (
              <div
                key={f.id}
                ref={(el) => {
                  overlayRefs.current[f.id] = el
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: 0,
                  transition: 'opacity 0.25s ease',
                  willChange: 'transform, opacity',
                  zIndex: f.isHost ? 4 : 3,
                }}
                title={f.isHost ? f.name : `${f.name} ${f.tier}×`}
              >
                <img
                  src={`https://flagcdn.com/w40/${f.flagIso}.png`}
                  alt={f.name}
                  width={flagW}
                  height={flagH}
                  style={{
                    borderRadius: '3px',
                    display: 'block',
                    objectFit: 'cover',
                    border: f.isHost ? '1px solid rgba(255,255,255,0.5)' : 'none',
                    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))',
                  }}
                />
              </div>
            ))}

            {EMOJIS.map((e) => (
              <div
                key={e.id}
                ref={(el) => {
                  overlayRefs.current[e.id] = el
                }}
                aria-label={e.ariaLabel}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: 0,
                  transition: 'opacity 0.25s ease',
                  willChange: 'transform, opacity',
                  fontSize: `${emojiSize}px`,
                  lineHeight: 1,
                  filter: `drop-shadow(0 4px 12px ${e.shadow})`,
                  zIndex: 5,
                }}
              >
                {e.emoji}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
