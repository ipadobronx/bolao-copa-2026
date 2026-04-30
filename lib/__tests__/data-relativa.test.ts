import { describe, expect, it } from 'vitest';
import { formatDataRelativa } from '@/lib/format/data-relativa';

// Helper: Date no fuso de Brasília (UTC-3, sem horário de verão desde 2019)
function brt(iso: string): Date {
  // ex: brt('2026-06-14T16:00') → 2026-06-14 16:00 BRT == 19:00 UTC
  return new Date(iso + '-03:00');
}

describe('formatDataRelativa', () => {
  it('mesmo dia, hora futura → "Hoje"', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-14T20:00'),
      agora: brt('2026-06-14T15:00'),
    });
    expect(out.date).toBe('Hoje');
    expect(out.hour).toBe('20:00');
  });

  it('dia seguinte mesmo mês → "Amanhã"', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-15T13:00'),
      agora: brt('2026-06-14T22:00'),
    });
    expect(out.date).toBe('Amanhã');
    expect(out.hour).toBe('13:00');
  });

  it('mais de 1 dia à frente → "EEE, DD/MM" abreviado em pt-BR', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-18T19:00'),
      agora: brt('2026-06-14T22:00'),
    });
    // 18/06/2026 é uma quinta-feira
    expect(out.date).toMatch(/^qui,? 18\/06$/i);
    expect(out.hour).toBe('19:00');
  });

  it('virada de meia-noite: data 00:30 do dia seguinte vista às 23:00 → "Amanhã"', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-15T00:30'),
      agora: brt('2026-06-14T23:00'),
    });
    expect(out.date).toBe('Amanhã');
    expect(out.hour).toBe('00:30');
  });

  it('hora sempre em fuso de Brasília mesmo se runtime estiver em UTC', () => {
    // 22:00 UTC == 19:00 BRT
    const out = formatDataRelativa({
      data: new Date('2026-06-14T22:00:00Z'),
      agora: new Date('2026-06-14T12:00:00Z'),
    });
    expect(out.hour).toBe('19:00');
  });

  it('semana seguinte cai no formato abreviado de dia da semana', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-21T18:00'),
      agora: brt('2026-06-14T10:00'),
    });
    // 21/06/2026 é um domingo
    expect(out.date).toMatch(/^dom,? 21\/06$/i);
  });
});
