export const COOKIE_OAUTH = 'jose_oauth';
export const COOKIE_SESSAO = 'jose_sessao';

export { voltarSeguro } from '../../../../compartilhado/voltar';

export function opcoesCookie(urlRequisicao: string, maxAgeSegundos: number) {
  return {
    httpOnly: true,
    secure: new URL(urlRequisicao).protocol === 'https:',
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: maxAgeSegundos,
  };
}

