import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { upsertPalpiteMock, toastErrorMock } = vi.hoisted(() => ({
  upsertPalpiteMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('@/app/(dashboard)/palpites/actions', () => ({
  upsertPalpite: upsertPalpiteMock,
}));
vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }));

import { MatchRow } from '../MatchRow';
import type { JogoComSelecoes, PalpiteSalvo } from '@/lib/palpites';

const JOGO_ABERTO: JogoComSelecoes = {
  id: 1,
  numero_jogo: 1,
  fase: 'grupos',
  data_hora: new Date(Date.now() + 86400000).toISOString(),
  finalizado: false,
  gols_casa: null,
  gols_fora: null,
  selecao_casa_id: 1,
  selecao_fora_id: 2,
  placeholder_casa: null,
  placeholder_fora: null,
  selecao_casa: { id: 1, nome: 'Brasil', bandeira_emoji: '🇧🇷', grupo: 'B' },
  selecao_fora: { id: 2, nome: 'Argentina', bandeira_emoji: '🇦🇷', grupo: 'B' },
};

const JOGO_FECHADO: JogoComSelecoes = {
  ...JOGO_ABERTO,
  data_hora: new Date(Date.now() - 86400000).toISOString(),
};

const JOGO_FINALIZADO: JogoComSelecoes = {
  ...JOGO_FECHADO,
  finalizado: true,
  gols_casa: 2,
  gols_fora: 1,
};

const PALPITE: PalpiteSalvo = {
  jogo_id: 1,
  gols_casa: 3,
  gols_fora: 0,
  pontos_calculados: 7,
};

beforeEach(() => {
  upsertPalpiteMock.mockReset();
  toastErrorMock.mockReset();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('MatchRow — estado open', () => {
  it('renderiza nome das seleções', () => {
    render(<MatchRow bilheteId="abc" jogo={JOGO_ABERTO} palpiteSalvo={null} />);
    expect(screen.getByText('Brasil')).toBeInTheDocument();
    expect(screen.getByText('Argentina')).toBeInTheDocument();
  });

  it('mostra chip "Pendente" quando sem palpite salvo', () => {
    render(<MatchRow bilheteId="abc" jogo={JOGO_ABERTO} palpiteSalvo={null} />);
    expect(screen.getByText(/pendente/i)).toBeInTheDocument();
  });

  it('mostra chip "Salvo" quando palpite já existe', () => {
    render(<MatchRow bilheteId="abc" jogo={JOGO_ABERTO} palpiteSalvo={PALPITE} />);
    expect(screen.getByText(/salvo/i)).toBeInTheDocument();
  });

  it('chama upsertPalpite após debounce de 1s ao digitar', async () => {
    upsertPalpiteMock.mockResolvedValue({ ok: true });
    render(<MatchRow bilheteId="abc" jogo={JOGO_ABERTO} palpiteSalvo={null} />);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0]!, { target: { value: '2' } });
    fireEvent.change(inputs[1]!, { target: { value: '1' } });

    expect(upsertPalpiteMock).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(upsertPalpiteMock).toHaveBeenCalledWith('abc', 1, 2, 1);
  });

  it('não chama upsertPalpite se apenas um campo preenchido', async () => {
    render(<MatchRow bilheteId="abc" jogo={JOGO_ABERTO} palpiteSalvo={null} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0]!, { target: { value: '2' } });
    vi.advanceTimersByTime(1000);
    expect(upsertPalpiteMock).not.toHaveBeenCalled();
  });

  it('mostra toast de erro se upsertPalpite falhar', async () => {
    upsertPalpiteMock.mockResolvedValue({ ok: false, error: 'Prazo encerrado.' });
    render(<MatchRow bilheteId="abc" jogo={JOGO_ABERTO} palpiteSalvo={null} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0]!, { target: { value: '1' } });
    fireEvent.change(inputs[1]!, { target: { value: '0' } });
    await act(async () => { vi.advanceTimersByTime(1000); });
    await Promise.resolve(); // flush promise from upsertPalpite
    expect(toastErrorMock).toHaveBeenCalledWith('Prazo encerrado.');
  });
});

describe('MatchRow — estado locked', () => {
  it('inputs são readonly', () => {
    render(<MatchRow bilheteId="abc" jogo={JOGO_FECHADO} palpiteSalvo={PALPITE} />);
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach((i) => expect(i).toHaveAttribute('readOnly'));
  });

  it('mostra chip "Fechado"', () => {
    render(<MatchRow bilheteId="abc" jogo={JOGO_FECHADO} palpiteSalvo={PALPITE} />);
    expect(screen.getByText(/fechado/i)).toBeInTheDocument();
  });
});

describe('MatchRow — estado finalized', () => {
  it('mostra pontos calculados', () => {
    render(<MatchRow bilheteId="abc" jogo={JOGO_FINALIZADO} palpiteSalvo={PALPITE} />);
    expect(screen.getByText(/7 pts/i)).toBeInTheDocument();
  });
});
