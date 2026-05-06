import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword: vi.fn(), signUp: vi.fn() },
  }),
}));

vi.mock('@/lib/validators/next', () => ({ safeNext: (v: unknown) => v ?? '/dashboard' }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

import LoginPage from './page';

describe('LoginPage', () => {
  it('renderiza h1 e toggle de modos', () => {
    render(<LoginPage searchParams={{}} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('modo login mostra campos email e senha', () => {
    render(<LoginPage searchParams={{}} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });
});
