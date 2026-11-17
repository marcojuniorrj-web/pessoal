import { criarProvedorGoogle, type ProvedorOAuth } from '../adaptadores/google/oauth';
import type { Ambiente } from '../ambiente';

/** Pontos de injeção (relógio e provedor de login), trocados nos testes. */
export interface Dependencias {
  agora: () => Date;
  provedorOAuth: (env: Ambiente, urlRetorno: string) => ProvedorOAuth;
}

export const dependenciasPadrao: Dependencias = {
  agora: () => new Date(),
  provedorOAuth: (env, urlRetorno) => criarProvedorGoogle(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, urlRetorno),
};

/** URL base do app: `URL_BASE` se existir, senão a origem da requisição. */
export function urlBase(env: Ambiente, urlRequisicao: string): string {
  return (env.URL_BASE || new URL(urlRequisicao).origin).replace(/\/$/, '');
}
