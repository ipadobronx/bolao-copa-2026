import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-border bg-bg-dark/95 sticky top-0 z-50 border-b px-6 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between">
        <Link
          href="/"
          aria-label="Mala na Copa — início"
          className="font-display flex items-center gap-2.5 text-base tracking-[1.5px] sm:text-lg md:text-2xl md:tracking-[2px]"
        >
          <span
            aria-hidden="true"
            className="bg-accent text-bg-dark flex h-9 w-9 -rotate-[5deg] items-center justify-center rounded-lg text-xl font-black"
          >
            M
          </span>
          <span className="text-text-primary">
            MALA NA <span className="text-accent">COPA</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-8">
          <a
            href="#how-it-works"
            className="text-text-secondary hover:text-accent hidden text-sm font-medium transition md:inline-flex"
          >
            Como funciona
          </a>
          <a
            href="#pontuacao"
            className="text-text-secondary hover:text-accent hidden text-sm font-medium transition md:inline-flex"
          >
            Pontuação
          </a>
          <a
            href="#cashback"
            className="text-text-secondary hover:text-accent hidden text-sm font-medium transition md:inline-flex"
          >
            Cashback
          </a>
          <Link href="/login" className="btn-primary">
            Entrar
          </Link>
        </nav>
      </div>
    </header>
  );
}
