import Link from 'next/link';

export default function PalpitesNotFound() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <p className="font-display text-text-muted mb-2 text-5xl">404</p>
      <h1 className="mb-1 text-xl font-bold">Tabela não encontrada</h1>
      <p className="text-text-muted mb-6 text-sm">
        Esse bilhete não existe ou não pertence à sua conta.
      </p>
      <Link href="/minhas-tabelas" className="text-accent text-sm underline">
        Ver minhas tabelas →
      </Link>
    </div>
  );
}
