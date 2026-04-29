'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="font-display text-danger text-7xl tracking-wide">erro</span>
      <p className="font-body text-text-secondary text-base">Algo deu errado. Tenta de novo.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="border-border-strong text-text-primary hover:border-accent hover:text-accent font-body rounded-md border px-4 py-2 text-sm"
      >
        Tentar novamente
      </button>
    </main>
  );
}
