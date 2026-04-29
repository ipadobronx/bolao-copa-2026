import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-border bg-bg-dark/95 sticky top-0 z-50 border-b px-6 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between">
        <Link
          href="/"
          aria-label="Bolão Copa 2026 — início"
          className="font-display flex items-center gap-2.5 text-2xl tracking-[2px]"
        >
          <span
            aria-hidden="true"
            className="bg-accent text-bg-dark flex h-9 w-9 -rotate-[5deg] items-center justify-center rounded-lg text-xl font-black"
          >
            B
          </span>
          <span className="text-text-primary">
            BOLÃO<span className="text-accent">26</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-8">
          <a
            href="#features"
            className="text-text-secondary hover:text-accent hidden text-sm font-medium transition md:inline-flex"
          >
            Como funciona
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
