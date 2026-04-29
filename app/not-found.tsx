import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="font-display text-accent text-8xl tracking-wide">404</span>
      <p className="font-body text-text-secondary text-lg">Página não encontrada.</p>
      <Link href="/" className="font-body text-accent text-sm underline-offset-4 hover:underline">
        Voltar pra home
      </Link>
    </main>
  );
}
