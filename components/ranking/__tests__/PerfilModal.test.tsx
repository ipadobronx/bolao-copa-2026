import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PerfilModal } from '../PerfilModal'
import type { RankingRowData } from '../RankingRow'

const entry: RankingRowData = {
  userId: 'u1', nome: 'Fulano da Silva', posicao: 1, pontosTotais: 30,
  acertosExatos: 2, acertosParciais: 0, totalBilhetes: 1, tendencia: null,
  isCurrentUser: false, melhorBilheteId: 'b1', forma: ['verde', 'cinza'],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ campeao: null, artilheiro: null }) }),
  ) as unknown as typeof fetch)
})

describe('<PerfilModal />', () => {
  it('renderiza nome e selo quando aberto', () => {
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    expect(screen.getByText('Fulano da Silva')).toBeInTheDocument()
    expect(screen.getByText('Bruxo')).toBeInTheDocument() // posição 1/100 = top 1%
  })
  it('não renderiza conteúdo quando entry é null', () => {
    render(<PerfilModal entry={null} total={100} onClose={() => {}} />)
    expect(screen.queryByText('Bruxo')).toBeNull()
  })
})
