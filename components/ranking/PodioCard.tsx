import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import { EscudoImg } from '@/components/ui/EscudoImg'
import type { PodioEntry } from './PodioSection'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' } as const

export function PodioCard({ entry }: { entry: PodioEntry }) {
  const { userId, nome, posicao, pontosTotais, totalBilhetes, isCurrentUser, clube } = entry
  return (
    <div className={`podio-card podio-pos-${posicao}`} aria-label={`${posicao}º lugar`}>
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
        {clube && <EscudoImg slug={clube} size={20} />}
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
