import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import type { PodioEntry } from './PodioSection'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' } as const

export function PodioCard({ entry }: { entry: PodioEntry }) {
  const { userId, nome, posicao, pontosTotais, totalBilhetes, isCurrentUser } = entry
  return (
    <div className={`podio-card podio-pos-${posicao}`}>
      <div className="podio-medal" aria-hidden="true">
        {MEDAL[posicao as 1 | 2 | 3] ?? ''}
      </div>
      <div
        className="podio-avatar"
        style={{ background: avatarColor(userId) }}
        aria-hidden="true"
      >
        {avatarInitials(nome)}
      </div>
      <div className="podio-nome">
        {nome}
        {isCurrentUser && <span className="rank-you-badge">Você</span>}
      </div>
      <div className="podio-meta">
        {totalBilhetes === 1 ? '1 tabela' : `${totalBilhetes} tabelas`}
      </div>
      <div className="podio-pts">{pontosTotais}</div>
      <div className="podio-pts-label">pontos</div>
    </div>
  )
}
