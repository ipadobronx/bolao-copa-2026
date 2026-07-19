import { render, screen, fireEvent } from '@testing-library/react'
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
  mockFetch({
    campeao: null, vice: null, terceiro: null, quarto: null, revelacao: null, artilheiro: null,
    numero: 117, pontos: 30, posicao: 1, exatos: 2, forma: [],
    tabelas: [], totalTabelas: 0, palpites: [],
  })
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
      campeao: null, vice: null, terceiro: null, quarto: null, revelacao: null,
      artilheiro: null, totalTabelas: 148, palpites: [],
      numero: 117, pontos: 50, posicao: 12, exatos: 0, forma: [],
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

  it('mostra só o dia mais recente e revela o resto no "Ver todos"', async () => {
    mockFetch({
      campeao: null, vice: null, terceiro: null, quarto: null, revelacao: null,
      artilheiro: null, tabelas: [], totalTabelas: 0,
      numero: 117, pontos: 30, posicao: 1, exatos: 2, forma: [],
      palpites: [
        { numeroJogo: 7, dataHora: '2026-06-13T22:00:00Z', casa: 'Brasil', fora: 'Marrocos', bandeiraCasa: null, bandeiraFora: null, palpiteCasa: 2, palpiteFora: 1, realCasa: 1, realFora: 1, finalizado: true, pontos: 2 },
        { numeroJogo: 15, dataHora: '2026-06-15T22:00:00Z', casa: 'Arábia Saudita', fora: 'Uruguai', bandeiraCasa: null, bandeiraFora: null, palpiteCasa: 1, palpiteFora: 1, realCasa: null, realFora: null, finalizado: false, pontos: null },
      ],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    expect(await screen.findByText('Arábia Saudita')).toBeInTheDocument()
    expect(screen.getByText('em andamento')).toBeInTheDocument()
    expect(screen.queryByText('Brasil')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /ver todos os palpites/i }))
    expect(screen.getByText('Brasil')).toBeInTheDocument()
  })

  it('mostra os 6 rótulos de bônus', async () => {
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    for (const label of ['Campeão', 'Vice', '3º lugar', '4º lugar', 'Artilheiro', 'Revelação']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
  })

  it('mostra pontos dos bônus: acerto amarelo, erro cinza, pendente sem badge', async () => {
    mockFetch({
      campeao: { nome: 'Espanha', bandeira: '🇪🇸', pontos: 50 },
      vice: { nome: 'França', bandeira: '🇫🇷', pontos: 0 },
      terceiro: null,
      quarto: null,
      revelacao: { nome: 'Noruega', bandeira: '🇳🇴', pontos: null },
      artilheiro: { nome: 'Mbappe', pontos: 25 },
      numero: 118, pontos: 681, posicao: 1, exatos: 14, forma: [],
      tabelas: [], totalTabelas: 0, palpites: [],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    expect(await screen.findByText('Espanha')).toBeInTheDocument()
    // acertos em amarelo
    expect(screen.getByText('+50').className).toContain('text-accent')
    expect(screen.getByText('+25').className).toContain('text-accent')
    // erro em cinza
    expect(screen.getByText('+0').className).toContain('text-text-muted')
    // revelação pendente: nome aparece, badge não — total de badges = 3 (+50, +0, +25)
    expect(screen.getByText('Noruega')).toBeInTheDocument()
    expect(screen.getAllByText(/^\+\d+$/)).toHaveLength(3)
    // artilheiro (agora objeto) renderiza o nome
    expect(screen.getByText('Mbappe')).toBeInTheDocument()
  })

  it('trocar de tabela mostra "Voltar"; voltar limpa', async () => {
    mockFetch({
      campeao: null, vice: null, terceiro: null, quarto: null, revelacao: null, artilheiro: null,
      numero: 117, pontos: 50, posicao: 12, exatos: 2, forma: [], totalTabelas: 148, palpites: [],
      tabelas: [
        { bilheteId: 'b1', numero: 117, pontos: 50, posicao: 12 },
        { bilheteId: 'b2', numero: 130, pontos: 20, posicao: 80 },
      ],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    fireEvent.click(await screen.findByText('Tabela nº130'))
    const voltar = await screen.findByText(/voltar/i)
    expect(voltar).toBeInTheDocument()
    fireEvent.click(voltar)
    expect(screen.queryByText(/voltar/i)).toBeNull()
  })
})
