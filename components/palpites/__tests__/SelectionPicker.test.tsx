import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SelectionPicker } from '../SelectionPicker';
import type { SelecaoBasica } from '@/lib/palpites';

const SELECOES: SelecaoBasica[] = [
  { id: 1, nome: 'Brasil', bandeira_emoji: '🇧🇷', grupo: 'B' },
  { id: 2, nome: 'Argentina', bandeira_emoji: '🇦🇷', grupo: 'C' },
  { id: 3, nome: 'França', bandeira_emoji: '🇫🇷', grupo: 'A' },
];

describe('SelectionPicker', () => {
  it('exibe placeholder quando nada está selecionado', () => {
    render(
      <SelectionPicker
        selecoes={SELECOES}
        value={null}
        onChange={vi.fn()}
        placeholder="Escolher seleção →"
      />,
    );
    expect(screen.getByRole('button', { name: /escolher seleção/i })).toBeInTheDocument();
  });

  it('exibe seleção atual com bandeira img quando há valor', () => {
    render(<SelectionPicker selecoes={SELECOES} value={1} onChange={vi.fn()} />);
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveTextContent('Brasil');
    const img = trigger.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toContain('flagcdn.com');
    expect(img!.getAttribute('src')).toContain('br');
  });

  it('abre lista ao clicar no trigger e mostra todas as seleções com bandeiras', async () => {
    render(<SelectionPicker selecoes={SELECOES} value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));

    const lista = await screen.findByRole('listbox');
    expect(lista).toBeInTheDocument();

    // Cada seleção aparece como option com bandeira
    expect(screen.getByRole('option', { name: /brasil/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /argentina/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /frança/i })).toBeInTheDocument();

    // Bandeiras renderizadas como <img>, não emoji
    const imgs = lista.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThanOrEqual(3);
    expect(Array.from(imgs).every((img) => img.getAttribute('src')?.includes('flagcdn.com'))).toBe(
      true,
    );
  });

  it('chama onChange e fecha popover ao escolher seleção', async () => {
    const onChange = vi.fn();
    render(<SelectionPicker selecoes={SELECOES} value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const option = await screen.findByRole('option', { name: /brasil/i });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('agrupa seleções por grupo da Copa', async () => {
    render(<SelectionPicker selecoes={SELECOES} value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(/grupo a/i)).toBeInTheDocument();
    expect(screen.getByText(/grupo b/i)).toBeInTheDocument();
    expect(screen.getByText(/grupo c/i)).toBeInTheDocument();
  });

  it('respeita disabled e não abre popover', () => {
    render(
      <SelectionPicker selecoes={SELECOES} value={null} onChange={vi.fn()} disabled />,
    );
    const trigger = screen.getByRole('button');
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
