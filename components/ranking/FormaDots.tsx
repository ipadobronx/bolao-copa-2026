const COR: Record<string, string> = {
  verde: 'bg-green-500',
  cinza: 'bg-slate-500',
  vermelho: 'bg-red-500',
  vazio: 'bg-white/15',
}

/** Bolinhas dos últimos jogos (estilo classificação): verde/cinza/vermelho/vazio. */
export function FormaDots({ forma }: { forma: string[] | null | undefined }) {
  if (!forma || forma.length === 0) return null
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-hidden="true">
      {forma.map((c, i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full ${COR[c] ?? COR.vazio}`}
        />
      ))}
    </span>
  )
}
