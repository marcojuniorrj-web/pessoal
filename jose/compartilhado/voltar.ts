/** Só aceita caminhos internos (evita redirecionar para outro site). */
export function voltarSeguro(voltar: string | undefined | null): string {
  if (!voltar || !voltar.startsWith('/') || voltar.startsWith('//') || voltar.startsWith('/\\')) return '/';
  return voltar;
}
