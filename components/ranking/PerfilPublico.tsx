// components/ranking/PerfilPublico.tsx
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'

export type PerfilPublicoProps = {
  userId: string
  nome: string
  numeroBilhete: number
  totalBilhetes: number
  posicao: number
  pontosTotais: number
  acertosExatos: number
  selecaoCashback: { nome: string; bandeira: string } | null
  valorPago: number | null
}

export function PerfilPublico(props: PerfilPublicoProps) {
  const {
    userId,
    nome,
    numeroBilhete,
    totalBilhetes,
    posicao,
    pontosTotais,
    acertosExatos,
    selecaoCashback,
    valorPago,
  } = props

  return (
    <div className="perfil-publico">
      <div className="perfil-header">
        <div
          className="perfil-avatar"
          style={{ background: avatarColor(userId) }}
          aria-hidden="true"
        >
          {avatarInitials(nome)}
        </div>
        <div>
          <h1 className="perfil-nome">{nome}</h1>
          <p className="perfil-meta">
            Tabela #{numeroBilhete} ·{' '}
            {totalBilhetes === 1 ? '1 tabela' : `${totalBilhetes} tabelas`}
          </p>
        </div>
      </div>

      <div className="perfil-kpis">
        <div className="kpi">
          <span className="kpi-value">{posicao}°</span>
          <span className="kpi-label">Posição</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{pontosTotais}</span>
          <span className="kpi-label">Pontos</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{acertosExatos}</span>
          <span className="kpi-label">Acertos exatos</span>
        </div>
      </div>

      {selecaoCashback && (
        <div className="perfil-cashback">
          <span aria-hidden="true">{selecaoCashback.bandeira}</span>{' '}
          <strong>{selecaoCashback.nome}</strong>
          {valorPago !== null && (
            <span className="perfil-cashback-valor">
              {' '}· apostou{' '}
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(valorPago)}{' '}
              em cashback
            </span>
          )}
        </div>
      )}
    </div>
  )
}
