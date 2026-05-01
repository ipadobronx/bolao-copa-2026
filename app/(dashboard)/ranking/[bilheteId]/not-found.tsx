// app/(dashboard)/ranking/[bilheteId]/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="ranking-empty">
      <p className="ranking-empty-title">Bilhete não encontrado</p>
      <p className="ranking-empty-sub">
        Este bilhete não existe ou ainda não foi confirmado.
      </p>
      <Link href="/ranking" className="btn-primary">
        Ver ranking →
      </Link>
    </div>
  )
}
