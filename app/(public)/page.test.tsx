import { render, screen } from '@testing-library/react';
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

  it('hero exibe título e CTA principal apontando pra /login', () => {
    renderLanding();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Palpite\.\s*Pontue\.\s*Leve R\$ 10 mil pra casa\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Comprar minha tabela/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('seção features tem id correto e renderiza 4 cards', () => {
    const { container } = renderLanding();
    expect(container.querySelector('#features')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Como funciona/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
  });

  it('seção cashback tem id correto e CTA aponta pra /login', () => {
    const { container } = renderLanding();
    expect(container.querySelector('#cashback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Garantir meu cashback/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('header tem links de âncora e CTA Entrar', () => {
    renderLanding();
    // Regexes ancoradas pra desambiguar:
    // - "Cashback" sem ^$ casaria também o "Garantir meu cashback" do promo
    // - "Entrar" sem ^$ poderia casar variantes do CTA principal
    expect(screen.getByRole('link', { name: /^Como funciona$/i })).toHaveAttribute(
      'href',
      '#features',
    );
    expect(screen.getByRole('link', { name: /^Cashback$/i })).toHaveAttribute('href', '#cashback');
    expect(screen.getByRole('link', { name: /^Entrar$/i })).toHaveAttribute('href', '/login');
  });

  it('footer mostra copyright e disclaimer', () => {
    renderLanding();
    expect(screen.getByText(/©\s*2026 Bolão Copa 2026/)).toBeInTheDocument();
    expect(
      screen.getByText(/Não afiliado à FIFA\. Competição entre conhecidos\./i),
    ).toBeInTheDocument();
  });
});
