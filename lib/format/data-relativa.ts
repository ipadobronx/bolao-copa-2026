type Args = {
  data: Date;
  agora: Date;
};

export function formatDataRelativa({ data, agora }: Args): { date: string; hour: string } {
  const TZ = 'America/Sao_Paulo';

  // YYYY-MM-DD da data e do "agora" no fuso de Brasília (sem hora) pra comparação de dias.
  const ymd = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  const ymdData = ymd(data);
  const ymdAgora = ymd(agora);

  // Diff em dias: parseia YYYY-MM-DD como UTC midnight pra evitar bugs de TZ na subtração.
  const diffDias = Math.round(
    (Date.parse(ymdData + 'T00:00:00Z') - Date.parse(ymdAgora + 'T00:00:00Z')) / 86_400_000,
  );

  let date: string;
  if (diffDias === 0) {
    date = 'Hoje';
  } else if (diffDias === 1) {
    date = 'Amanhã';
  } else {
    const diaSemana = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ,
      weekday: 'short',
    })
      .format(data)
      .replace('.', '')
      .replace(/^(\w)/, (m) => m.toLowerCase());
    const diaMes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ,
      day: '2-digit',
      month: '2-digit',
    }).format(data);
    date = `${diaSemana}, ${diaMes}`;
  }

  const hour = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(data);

  return { date, hour };
}
