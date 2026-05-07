import { describe, expect, it } from 'vitest';

import {
  parseRangeFromParams,
  resolvePreset,
  toDateInputValue,
} from './date-range';

const NOW = new Date('2026-05-07T15:30:00'); // local time

describe('resolvePreset', () => {
  it('"hoje" → 00:00 do dia atual até 00:00 do dia seguinte', () => {
    const r = resolvePreset('hoje', NOW);
    expect(r.from.toISOString().startsWith('2026-05-07T')).toBe(true);
    expect(r.from.getHours()).toBe(0);
    expect(r.to.getDate()).toBe(8);
    expect(r.to.getHours()).toBe(0);
  });

  it('"ontem" → 00:00 do dia anterior até 00:00 de hoje', () => {
    const r = resolvePreset('ontem', NOW);
    expect(r.from.getDate()).toBe(6);
    expect(r.from.getHours()).toBe(0);
    expect(r.to.getDate()).toBe(7);
    expect(r.to.getHours()).toBe(0);
  });

  it('"7d" → últimos 7 dias inclusivos (D-6 → D+1)', () => {
    const r = resolvePreset('7d', NOW);
    expect(r.from.getDate()).toBe(1); // 7 - 6 = 1
    expect(r.to.getDate()).toBe(8); // hoje + 1
  });

  it('"30d" → últimos 30 dias inclusivos', () => {
    const r = resolvePreset('30d', NOW);
    expect(r.from.getMonth()).toBe(3); // abril (0-indexed)
    expect(r.from.getDate()).toBe(8); // 7 - 29 = -22 → 8 de abril
    expect(r.to.getDate()).toBe(8);
    expect(r.to.getMonth()).toBe(4); // maio
  });
});

describe('parseRangeFromParams', () => {
  it('default sem params → preset "7d"', () => {
    const { preset } = parseRangeFromParams({}, NOW);
    expect(preset).toBe('7d');
  });

  it('preset válido é respeitado', () => {
    const { preset } = parseRangeFromParams({ preset: 'hoje' }, NOW);
    expect(preset).toBe('hoje');
  });

  it('preset desconhecido cai pra "7d"', () => {
    const { preset } = parseRangeFromParams({ preset: 'lixo' }, NOW);
    expect(preset).toBe('7d');
  });

  it('custom com from/to válidos resolve range', () => {
    const { range, preset } = parseRangeFromParams(
      { preset: 'custom', from: '2026-04-01', to: '2026-04-15' },
      NOW,
    );
    expect(preset).toBe('custom');
    expect(range.from.getDate()).toBe(1);
    expect(range.from.getMonth()).toBe(3); // abril
    // to é exclusivo (próximo dia)
    expect(range.to.getDate()).toBe(16);
  });

  it('custom com datas invertidas cai pra "7d"', () => {
    const { preset } = parseRangeFromParams(
      { preset: 'custom', from: '2026-04-15', to: '2026-04-01' },
      NOW,
    );
    expect(preset).toBe('7d');
  });

  it('custom sem datas cai pra "7d"', () => {
    const { preset } = parseRangeFromParams({ preset: 'custom' }, NOW);
    expect(preset).toBe('7d');
  });
});

describe('toDateInputValue', () => {
  it('formata YYYY-MM-DD em local time', () => {
    expect(toDateInputValue(new Date('2026-05-07T15:30:00'))).toBe('2026-05-07');
    expect(toDateInputValue(new Date('2026-01-03T00:00:00'))).toBe('2026-01-03');
  });
});
