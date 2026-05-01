'use client';

type Props = { grupos: string[] };

export function GrupoNav({ grupos }: Props) {
  function scrollTo(grupo: string) {
    document.getElementById(`grupo-${grupo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="mb-5 overflow-x-auto pb-1">
      <div className="flex gap-1.5">
        {grupos.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => scrollTo(g)}
            className="bg-bg-elevated border-border text-text-secondary hover:text-text-primary hover:border-accent/60 min-w-[2.25rem] rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition-colors"
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
