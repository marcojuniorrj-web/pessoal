export const COOKIE_OAUTH = 'jose_oauth';
export const COOKIE_SESSAO = 'jose_sessao';

/** Só aceita caminhos internos (evita redirecionar para outro site). */
export function voltarSeguro(voltar: string | undefined | null): string {
  if (!voltar || !voltar.startsWith('/') || voltar.startsWith('//') || voltar.startsWith('/\\')) return '/';
  return voltar;
}

export function opcoesCookie(urlRequisicao: string, maxAgeSegundos: number) {
  return {
    httpOnly: true,
    secure: new URL(urlRequisicao).protocol === 'https:',
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: maxAgeSegundos,
  };
}

