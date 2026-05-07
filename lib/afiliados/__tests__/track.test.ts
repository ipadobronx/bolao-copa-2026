import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'afiliado_ref';

// Node 25 expõe `localStorage = {}` (vazio, sem métodos) como global, mascarando
// o Storage do jsdom. Substituímos por um Map-backed stub antes do import do
// módulo sob teste.
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  key(i: number) {
    return Array.from(this.data.keys())[i] ?? null;
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
}

const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;
const stubStorage = new MemoryStorage();

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: stubStorage,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: originalLocalStorage,
  });
});

// Importa após instalar o stub pra garantir que track.ts use ele.
const { AFILIADO_CODIGO_REGEX, captureAffiliateRef, clearAffiliateRef, getAffiliateRef } =
  await import('@/lib/afiliados/track');

function setUrl(search: string) {
  // history.pushState preserva location/origin → localStorage segue funcionando
  window.history.pushState({}, '', `/${search}`);
}

describe('AFILIADO_CODIGO_REGEX', () => {
  it.each(['jose', 'maria2026', 'ana_b', 'a-b-c', 'abc', 'a'.repeat(30)])(
    'aceita %s',
    (s) => {
      expect(AFILIADO_CODIGO_REGEX.test(s)).toBe(true);
    },
  );

  it.each([
    'AB',                    // 2 chars (mín. 3)
    'a'.repeat(31),          // 31 chars (máx. 30)
    'JOSE',                  // uppercase
    'jose silva',            // espaço
    'ana@bc',                // arroba
    'has.dot',               // ponto
    '',                      // vazio
    'já',                    // unicode
  ])('rejeita %s', (s) => {
    expect(AFILIADO_CODIGO_REGEX.test(s)).toBe(false);
  });
});

describe('captureAffiliateRef', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('salva ref válido com TTL 30 dias', () => {
    const NOW = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    setUrl('?ref=jose');

    captureAffiliateRef();

    const stored = JSON.parse(globalThis.localStorage.getItem(KEY)!);
    expect(stored.ref).toBe('jose');
    expect(stored.expires).toBe(NOW + 30 * 24 * 60 * 60 * 1000);
  });

  it('ignora ref inválido (regex falha)', () => {
    setUrl('?ref=ABC');
    captureAffiliateRef();
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });

  it('ignora ref ausente', () => {
    setUrl('?utm_source=facebook');
    captureAffiliateRef();
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });

  it('ignora ref vazio', () => {
    setUrl('?ref=');
    captureAffiliateRef();
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });

  it('last-click: sobrescreve ref anterior', () => {
    setUrl('?ref=jose');
    captureAffiliateRef();
    setUrl('?ref=maria');
    captureAffiliateRef();

    const stored = JSON.parse(globalThis.localStorage.getItem(KEY)!);
    expect(stored.ref).toBe('maria');
  });

  it('preserva ref anterior quando o novo é inválido (regex falha → no-op)', () => {
    setUrl('?ref=jose');
    captureAffiliateRef();
    setUrl('?ref=AB');
    captureAffiliateRef();

    const stored = JSON.parse(globalThis.localStorage.getItem(KEY)!);
    expect(stored.ref).toBe('jose');
  });
});

describe('getAffiliateRef', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('retorna null quando não há nada armazenado', () => {
    expect(getAffiliateRef()).toBeNull();
  });

  it('retorna o ref válido dentro do TTL', () => {
    setUrl('?ref=jose');
    captureAffiliateRef();
    expect(getAffiliateRef()).toBe('jose');
  });

  it('retorna null e limpa storage quando expirado', () => {
    const NOW = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    setUrl('?ref=jose');
    captureAffiliateRef();

    vi.setSystemTime(NOW + 31 * 24 * 60 * 60 * 1000);
    expect(getAffiliateRef()).toBeNull();
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });

  it('retorna null e limpa quando JSON corrupto', () => {
    globalThis.localStorage.setItem(KEY, 'not-json');
    expect(getAffiliateRef()).toBeNull();
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });

  it('retorna null e limpa quando shape errado', () => {
    globalThis.localStorage.setItem(KEY, JSON.stringify({ x: 1 }));
    expect(getAffiliateRef()).toBeNull();
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });

  it('retorna null e limpa quando ref armazenado falha regex (defesa em profundidade)', () => {
    globalThis.localStorage.setItem(
      KEY,
      JSON.stringify({ ref: 'INVALID-UPPER', expires: Date.now() + 1_000_000 }),
    );
    expect(getAffiliateRef()).toBeNull();
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });
});

describe('clearAffiliateRef', () => {
  it('remove entrada do storage', () => {
    setUrl('?ref=jose');
    captureAffiliateRef();
    expect(globalThis.localStorage.getItem(KEY)).not.toBeNull();

    clearAffiliateRef();
    expect(globalThis.localStorage.getItem(KEY)).toBeNull();
  });

  it('é no-op quando não há entrada', () => {
    expect(() => clearAffiliateRef()).not.toThrow();
  });
});
