export function SiteFooter() {
  return (
    <footer className="border-border border-t py-10">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-text-secondary font-body text-sm">© 2026 Mala na Copa</p>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-5">
            {[
              { label: 'Termos de Uso', href: '/termos' },
              { label: 'Privacidade', href: '/privacidade' },
              { label: 'FAQ', href: '/faq' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-text-muted hover:text-text-secondary font-mono text-xs transition"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <p className="text-text-muted font-mono text-xs">
          Não afiliado à FIFA. Competição entre conhecidos. Copa do Mundo FIFA 2026 · 11/06 – 19/07.
        </p>
      </div>
    </footer>
  )
}
