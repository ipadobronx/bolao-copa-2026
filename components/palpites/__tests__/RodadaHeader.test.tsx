import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RodadaHeader } from '../RodadaHeader';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const AGORA = new Date('2026-06-10T12:00:00Z');

describe('RodadaHeader', () => {
  it('mostra data quando deadline > 24h', () => {
    vi.setSystemTime(AGORA);
    const deadline = new Date(AGORA.getTime() + 48 * 3600 * 1000).toISOString();
    render(<RodadaHeader numero={1} deadline={deadline} />);
    expect(screen.getByText(/Rodada 1/)).toBeInTheDocument();
    expect(screen.queryByText(/^h$/)).not.toBeInTheDocument(); // sem label "h" do countdown urgente
  });

  it('mostra countdown quando deadline < 24h', () => {
    vi.setSystemTime(AGORA);
    const deadline = new Date(AGORA.getTime() + 8 * 3600 * 1000).toISOString();
    render(<RodadaHeader numero={2} deadline={deadline} />);
    expect(screen.getByText(/Rodada 2/)).toBeInTheDocument();
    expect(screen.getByText(/08/)).toBeInTheDocument();
  });

  it('mostra "encerrada" quando deadline no passado', () => {
    vi.setSystemTime(AGORA);
    const deadline = new Date(AGORA.getTime() - 1000).toISOString();
    render(<RodadaHeader numero={3} deadline={deadline} />);
    expect(screen.getByText(/encerrada/i)).toBeInTheDocument();
  });
});
