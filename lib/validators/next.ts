const INTERNAL_PATH = /^\/(?!\/)/;

export function safeNext(value: string | null | undefined, fallback: string = '/dashboard'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  return INTERNAL_PATH.test(value) ? value : fallback;
}
