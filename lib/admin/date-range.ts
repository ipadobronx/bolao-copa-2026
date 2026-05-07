// Pure helpers para resolver presets de date range usados nos KPIs admin.
// Sem dependências externas — testáveis isoladamente.

export type DateRangePreset = 'hoje' | 'ontem' | '7d' | '30d' | 'custom';

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Custom' },
];

export type DateRange = {
  from: Date;
  to: Date; // exclusivo (próximo dia 00:00 quando o range é "até hoje")
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function resolvePreset(preset: DateRangePreset, now: Date = new Date()): DateRange {
  const today = startOfDay(now);
  switch (preset) {
    case 'hoje':
      return { from: today, to: addDays(today, 1) };
    case 'ontem':
      return { from: addDays(today, -1), to: today };
    case '7d':
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case '30d':
      return { from: addDays(today, -29), to: addDays(today, 1) };
    case 'custom':
      // Custom não resolve sozinho — chamadores devem usar `parseCustomRange`.
      return { from: addDays(today, -6), to: addDays(today, 1) };
  }
}

// Lê searchParams (?from=YYYY-MM-DD&to=YYYY-MM-DD&preset=...) e devolve range.
// Falhas (datas inválidas, ordem invertida) caem no preset default '7d'.
export function parseRangeFromParams(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): { range: DateRange; preset: DateRangePreset } {
  const presetRaw = typeof params.preset === 'string' ? params.preset : null;
  const preset =
    presetRaw === 'hoje' ||
    presetRaw === 'ontem' ||
    presetRaw === '7d' ||
    presetRaw === '30d' ||
    presetRaw === 'custom'
      ? (presetRaw as DateRangePreset)
      : '7d';

  if (preset === 'custom') {
    const fromStr = typeof params.from === 'string' ? params.from : null;
    const toStr = typeof params.to === 'string' ? params.to : null;
    if (fromStr && toStr) {
      const from = new Date(`${fromStr}T00:00:00`);
      const to = new Date(`${toStr}T00:00:00`);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from < to) {
        return { range: { from, to: addDays(to, 1) }, preset };
      }
    }
    return { range: resolvePreset('7d', now), preset: '7d' };
  }

  return { range: resolvePreset(preset, now), preset };
}

// Formata YYYY-MM-DD em local time (não UTC) — usado nos query params.
export function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
