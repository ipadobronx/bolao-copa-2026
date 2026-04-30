import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// LoginForm uses Supabase + env; in the page smoke test we don't exercise it,
// but we still need imports not to throw.
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOtp: vi.fn() } }),
}));
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  },
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
