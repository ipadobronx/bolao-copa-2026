import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProximosJogosPanel } from './ProximosJogosPanel';
import type { JogoRowData } from './JogoRow';

const AGORA = new Date('2026-06-14T10:00:00-03:00');

const jogo = (overrides: Partial<JogoRowData> = {}): JogoRowData => ({
  id: 1,
  data_hora: '2026-06-14T16:00:00-03:00',
  fase: 'grupos',
  placeholder_casa: null,
  placeholder_fora: null,
  casa: { nome: 'Brasil', bandeira_emoji: '🇧🇷' },
  fora: { nome: 'Sérvia', bandeira_emoji: '🇷🇸' },
  ...overrides,
});

describe('<ProximosJogosPanel/>', () => {
  it('renderiza n linhas a partir do array de jogos', () => {
    render(
      <ProximosJogosPanel
        agora={AGORA}
        jogos={[jogo({ id: 1 }), jogo({ id: 2 }), jogo({ id: 3 })]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('jogo definido sem tabelas: link Palpitar vai pra /comprar', () => {
    render(<ProximosJogosPanel agora={AGORA} jogos={[jogo({ id: 42 })]} />);
    expect(screen.getByRole('link', { name: /palpitar/i })).toHaveAttribute('href', '/comprar');
  });

  it('jogo definido com 1 tabela: link vai pro deep-link ?jogo=', () => {
    render(
      <ProximosJogosPanel
        agora={AGORA}
        jogos={[jogo({ id: 42 })]}
        tabelas={[{ id: 'b1', numero: 1, pontos: 0 }]}
      />,
    );
    expect(screen.getByRole('link', { name: /palpitar/i })).toHaveAttribute(
      'href',
      '/palpites/b1?jogo=42',
    );
  });

  it('jogo TBD (sem seleção) desabilita o CTA', () => {
    render(
      <ProximosJogosPanel
        agora={AGORA}
        jogos={[
          jogo({
            id: 99,
            casa: null,
            fora: null,
            placeholder_casa: 'Vencedor jogo 80',
            placeholder_fora: 'Vencedor jogo 81',
            fase: 'oitavas',
          }),
        ]}
      />,
    );
    expect(screen.queryByRole('link', { name: /palpitar/i })).not.toBeInTheDocument();
    expect(
      screen.getByText('Palpitar', { selector: '[aria-disabled="true"]' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Vencedor jogo 80/)).toBeInTheDocument();
  });

  it('lista vazia renderiza empty state "A Copa acabou"', () => {
    render(<ProximosJogosPanel agora={AGORA} jogos={[]} />);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByText(/A Copa acabou/i)).toBeInTheDocument();
  });

  it('errored renderiza fallback de erro mesmo com jogos no array', () => {
    render(<ProximosJogosPanel agora={AGORA} jogos={[jogo({ id: 1 })]} errored />);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível carregar/i)).toBeInTheDocument();
  });

});
