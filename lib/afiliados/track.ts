/**
 * Captura/recupera atribuição de afiliado no client.
 * Last-click: sempre sobrescreve. TTL 30 dias. Validação por regex (mesma do
 * banco: ^[a-z0-9_-]{3,30}$).
 */

const STORAGE_KEY = 'afiliado_ref';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const AFILIADO_CODIGO_REGEX = /^[a-z0-9_-]{3,30}$/;

type StoredRef = { ref: string; expires: number };

function getStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  // No browser, globalThis === window. No SSR/Node, localStorage pode não existir.
  return (globalThis as { localStorage?: Storage }).localStorage ?? null;
}

function getSearch(): string {
  if (typeof globalThis === 'undefined') return '';
  return (globalThis as { location?: { search?: string } }).location?.search ?? '';
}

function isStoredRef(value: unknown): value is StoredRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredRef).ref === 'string' &&
    typeof (value as StoredRef).expires === 'number'
  );
}

/**
 * Lê `?ref=` da URL atual e, se válido, persiste no localStorage com TTL 30d.
 * No-op em SSR.
 */
export function captureAffiliateRef(): void {
  const storage = getStorage();
  if (!storage) return;

  const params = new URLSearchParams(getSearch());
  const ref = params.get('ref');
  if (!ref || !AFILIADO_CODIGO_REGEX.test(ref)) return;

  const payload: StoredRef = { ref, expires: Date.now() + TTL_MS };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponível (modo privado, quota cheia) — atribuição falha silenciosamente.
  }
}

/**
 * Retorna o código do afiliado armazenado, ou null se ausente/expirado/inválido.
 * Limpa entradas expiradas como side-effect.
 */
export function getAffiliateRef(): string | null {
  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearAffiliateRef();
    return null;
  }

  if (!isStoredRef(parsed)) {
    clearAffiliateRef();
    return null;
  }

  if (Date.now() > parsed.expires) {
    clearAffiliateRef();
    return null;
  }

  if (!AFILIADO_CODIGO_REGEX.test(parsed.ref)) {
    clearAffiliateRef();
    return null;
  }

  return parsed.ref;
}

export function clearAffiliateRef(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
