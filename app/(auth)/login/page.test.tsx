import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// LoginForm uses Supabase browser client at module load (via createSupabaseBrowserClient).
// We don't exercise it in the page smoke test, but the import path must not throw.
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOtp: vi.fn() } }),
}));

import LoginPage from './page';

describe('LoginPage', () => {
  it('renderiza h1 "Entrar" e os 2 inputs do form', () => {
    render(<LoginPage searchParams={{}} />);
    expect(screen.getByRole('heading', { level: 1, name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /receber link/i })).toBeInTheDocument();
  });

  it('NÃO mostra banner de erro quando searchParams.error está ausente', () => {
    render(<LoginPage searchParams={{}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mostra banner de erro quando searchParams.error === "link-invalido"', () => {
    render(<LoginPage searchParams={{ error: 'link-invalido' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/link expirou ou já foi usado/i);
  });
});
