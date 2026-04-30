export function iniciais(nome: string | null | undefined): string {
  if (!nome) return '?';
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return '?';
  if (palavras.length === 1) return palavras[0]!.slice(0, 1).toUpperCase();
  return (palavras[0]![0]! + palavras[palavras.length - 1]![0]!).toUpperCase();
}
