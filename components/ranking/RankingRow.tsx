import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import { EscudoImg } from '@/components/ui/EscudoImg'

export type RankingRowData = {
  userId: string
  nome: string
  posicao: number
  pontosTotais: number
  acertosExatos: number
  acertosParciais: number
  totalBilhetes: number
  tendencia: number | null  // positivo = subiu, negativo = caiu, 0 ou null = igual
  isCurrentUser: boolean
  emoji?: string | null
  clube?: string | null
}

const POS_CLASS: Record<number, string> = {
  1: 'rank-pos-gold',
  2: 'rank-pos-silver',
  3: 'rank-pos-bronze',
}

export function RankingRow({ data }: { data: RankingRowData }) {
  const { userId, nome, posicao, pontosTotais, acertosExatos, acertosParciais,
          totalBilhetes, tendencia, isCurrentUser, emoji, clube } = data

  const posClass = POS_CLASS[posicao] ?? 'rank-pos-normal'
  const trendSign = tendencia === null || tendencia === 0 ? 0 : tendencia > 0 ? 1 : -1
  const trendLabel = trendSign === 1 ? `▲ ${tendencia}` : trendSign === -1 ? `▼ ${Math.abs(tendencia!)}` : '━'
  const trendClass = trendSign === 1 ? 'trend-up' : trendSign === -1 ? 'trend-down' : 'trend-same'

  return (
    <tr className={isCurrentUser ? 'rank-row-me' : undefined}>
      <td>
        <div className={`rank-pos ${posClass}`}>{posicao}</div>
      </td>
      <td>
        <div className="rank-user">
          <div
            className="rank-avatar"
            style={{ background: avatarColor(userId) }}
            aria-hidden="true"
          >
            {avatarInitials(nome)}
          </div>
          <div className="min-w-0">
            <div className="rank-name">
              {nome}
              {clube && <EscudoImg slug={clube} />}
              {isCurrentUser && <span className="rank-you-badge">Você</span>}
            </div>
            <div className="rank-meta">
              <span>{totalBilhetes === 1 ? '1 tabela' : `${totalBilhetes} tabelas`}</span>
              {/* Acertos só aparecem em coluna no desktop; no mobile entram aqui */}
              <span className="sm:hidden">
                {' · '}
                <strong>{acertosExatos}</strong> ex · <strong>{acertosParciais}</strong> parc
              </span>
            </div>
          </div>
        </div>
      </td>
      <td className="rank-acertos hidden sm:table-cell">
        <strong>{acertosExatos}</strong> ex ·{' '}
        <strong>{acertosParciais}</strong> parc
      </td>
      <td className="hidden sm:table-cell">
        <span className={`rank-trend ${trendClass}`}>{trendLabel}</span>
      </td>
      <td className="rank-pts">
        {emoji && <span className="mr-1" aria-hidden="true">{emoji}</span>}
        {pontosTotais}
      </td>
    </tr>
  )
}
