import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PerfilModal } from '../PerfilModal'
import type { RankingRowData } from '../RankingRow'

const entry: RankingRowData = {
  userId: 'u1', nome: 'Fulano da Silva', posicao: 1, pontosTotais: 30,
  acertosExatos: 2, acertosParciais: 0, totalBilhetes: 3, tendencia: null,
  isCurrentUser: false, melhorBilheteId: 'b1', forma: ['verde', 'cinza'],
}

function mockFetch(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(payload) }),
  ) as unknown as typeof fetch)
}

beforeEach(() => {
  mockFetch({ campeao: null, artilheiro: null, tabelas: [], totalTabelas: 0, palpites: [] })
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
  it('lista pontuação por tabela quando há 2+ tabelas', async () => {
    mockFetch({
      campeao: null, artilheiro: null, totalTabelas: 148, palpites: [],
      tabelas: [
        { bilheteId: 'b1', numero: 117, pontos: 50, posicao: 12 },
        { bilheteId: 'b2', numero: 130, pontos: 20, posicao: 80 },
      ],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    expect(await screen.findByText('Pontuação por tabela')).toBeInTheDocument()
    expect(screen.getByText('Tabela nº117')).toBeInTheDocument()
    expect(screen.getByText('Tabela nº130')).toBeInTheDocument()
  })

  it('mostra a seção de palpites nos jogos (finalizado + em andamento)', async () => {
    mockFetch({
      campeao: null, artilheiro: null, tabelas: [], totalTabelas: 0,
      palpites: [
        { numeroJogo: 7, dataHora: '2026-06-13T22:00:00Z', casa: 'Brasil', fora: 'Marrocos', bandeiraCasa: null, bandeiraFora: null, palpiteCasa: 2, palpiteFora: 1, realCasa: 1, realFora: 1, finalizado: true, pontos: 2 },
        { numeroJogo: 15, dataHora: '2026-06-15T22:00:00Z', casa: 'Arábia Saudita', fora: 'Uruguai', bandeiraCasa: null, bandeiraFora: null, palpiteCasa: 1, palpiteFora: 1, realCasa: null, realFora: null, finalizado: false, pontos: null },
      ],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    expect(await screen.findByText('Palpites nos jogos')).toBeInTheDocument()
    expect(screen.getByText('Brasil')).toBeInTheDocument()
    expect(screen.getByText('em andamento')).toBeInTheDocument()
  })
})
