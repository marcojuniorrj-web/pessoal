import { criarProvedorGoogle, type ProvedorOAuth } from '../adaptadores/google/oauth';
import { criarTranscritorWhisper, type Transcritor } from '../adaptadores/voz/whisper';
import type { Ambiente } from '../ambiente';

/** Pontos de injeção (relógio e provedor de login), trocados nos testes. */
export interface Dependencias {
  agora: () => Date;
  provedorOAuth: (env: Ambiente, urlRetorno: string) => ProvedorOAuth;
  /** undefined quando o ambiente não tem Workers AI (ex.: dev local sem login). */
  transcritor: (env: Ambiente) => Transcritor | undefined;
}

export const dependenciasPadrao: Dependencias = {
  agora: () => new Date(),
  provedorOAuth: (env, urlRetorno) => criarProvedorGoogle(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, urlRetorno),
  transcritor: (env) => (env.AI ? criarTranscritorWhisper(env.AI) : undefined),
};

/** URL base do app: `URL_BASE` se existir, senão a origem da requisição. */
export function urlBase(env: Ambiente, urlRequisicao: string): string {
  return (env.URL_BASE || new URL(urlRequisicao).origin).replace(/\/$/, '');
}
