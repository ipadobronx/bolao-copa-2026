import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PublicLayout from './layout';
import HomePage from './page';

const renderLanding = () =>
  render(
    <PublicLayout>
      <HomePage />
    </PublicLayout>,
  );

describe('Landing page', () => {
  it('renderiza landmarks principais', () => {
    renderLanding();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('hero exibe prize R$10.000 e CTA principal apontando pra /login', () => {
    renderLanding();
    expect(screen.getByLabelText(/R\$ 10\.000 em prêmios/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Copa 2026/i })).toBeInTheDocument();
    const ctaPrimario = screen.getAllByRole('link', { name: /Quero participar/i })[0];
    expect(ctaPrimario).toHaveAttribute('href', '/login');
  });

  it('seção how-it-works tem id correto e renderiza 5 cards', () => {
    const { container } = renderLanding();
    const section = container.querySelector('#how-it-works') as HTMLElement;
    expect(section).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Como funciona/i })).toBeInTheDocument();
    expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(5);
  });

  it('seção cashback tem id correto e CTA aponta pra /login', () => {
    const { container } = renderLanding();
    expect(container.querySelector('#cashback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Garantir meu cashback/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('seção pontuacao existe com id correto', () => {
    const { container } = renderLanding();
    expect(container.querySelector('#pontuacao')).toBeInTheDocument();
  });

  it('seção premios existe com id correto', () => {
    const { container } = renderLanding();
    expect(container.querySelector('#premios')).toBeInTheDocument();
  });

  it('header tem links de âncora e CTA Entrar', () => {
    renderLanding();
    const nav = screen.getByRole('navigation', { name: /Principal/i });
    expect(within(nav).getByRole('link', { name: /^Como funciona$/i })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    expect(within(nav).getByRole('link', { name: /^Cashback$/i })).toHaveAttribute('href', '#cashback');
    expect(within(nav).getByRole('link', { name: /^Entrar$/i })).toHaveAttribute('href', '/login');
  });

  it('footer mostra copyright e disclaimer', () => {
    renderLanding();
    expect(screen.getByText(/©\s*2026 Mala na Copa/)).toBeInTheDocument();
    expect(
      screen.getByText(/Não afiliado à FIFA\. Competição entre conhecidos\./i),
    ).toBeInTheDocument();
  });
});
