import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Página não encontrada',
  description: 'A página que você procurou não existe.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="bg-bg-dark flex min-h-screen items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="font-display text-accent text-8xl leading-none tracking-wide md:text-[200px]">
          404
        </h1>

        <h2 className="font-display text-text-primary mt-4 text-3xl tracking-wide md:text-5xl">
          Esse jogo <span className="text-accent">não tá na tabela</span>
        </h2>

        <p className="text-text-secondary font-body mx-auto mt-6 max-w-md leading-relaxed">
          A página que você procurou foi pro chuveiro mais cedo. Mas a Copa 2026
          segue rolando aqui.
        </p>

        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/" className="btn-primary">
            Voltar pra landing
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Ir pro dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
