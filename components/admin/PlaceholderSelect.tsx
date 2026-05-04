'use client'

type SelecaoBasica = {
  id: number
  nome: string
  bandeira_emoji: string
}

type Props = {
  value: number | null
  onChange: (id: number | null) => void
  selecoes: SelecaoBasica[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function PlaceholderSelect({
  value,
  onChange,
  selecoes,
  placeholder = 'Selecionar seleção…',
  disabled,
  className,
}: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled}
      className={[
        'bg-bg-elevated border-border text-text-primary rounded-md border px-2 py-1.5',
        'font-body text-sm focus:border-accent focus:ring-accent/20 focus:outline-none focus:ring-2',
        'disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <option value="">{placeholder}</option>
      {selecoes.map((s) => (
        <option key={s.id} value={s.id}>
          {s.bandeira_emoji} {s.nome}
        </option>
      ))}
    </select>
  )
}
