import Link from 'next/link'
import type { Route } from 'next'
import { Lock, ArrowRight } from 'lucide-react'

export function DashboardEmptyHero() {
  return (
    <section
      aria-labelledby="empty-hero-heading"
      className="panel border-accent/40 from-bg-card to-bg-card/50 relative overflow-hidden bg-gradient-to-b p-10 text-center md:p-16"
    >
      <div aria-hidden="true" className="bg-accent/5 pointer-events-none absolute inset-0 blur-3xl" />
      <Lock className="text-accent relative mx-auto mb-6 size-16" strokeWidth={1.5} />
      <h2 id="empty-hero-heading" className="font-display relative text-3xl tracking-wide md:text-5xl">
        Sua participação na <span className="text-accent">Copa 2026</span> começa aqui
      </h2>
      <p className="font-body text-text-secondary relative mx-auto mt-3 max-w-md text-sm md:text-base">
        Compre sua primeira tabela e entre na disputa pelo prêmio de R$ 10.000
      </p>
      <Link
        href={'/comprar' as Route}
        className="bg-accent text-bg-dark hover:bg-accent/90 relative mt-8 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-colors"
      >
        Comprar tabela <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}
