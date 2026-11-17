import type { PerfilGoogle, ProvedorOAuth } from '../src/adaptadores/google/oauth';
import type { Transcritor } from '../src/adaptadores/voz/whisper';
import type { Ambiente } from '../src/ambiente';
import { criarApp } from '../src/index';
import type { Dependencias } from '../src/compartilhado/dependencias';
import { criarD1Simulado } from './d1-simulado';

export const URL_TESTE = 'https://jose.exemplo.dev';

export function criarAmbienteTeste(extra: Partial<Ambiente> = {}): Ambiente {
  return {
    DB: criarD1Simulado(),
    ASSETS: { fetch: async () => new Response('asset') } as unknown as Fetcher,
    GOOGLE_CLIENT_ID: 'id-teste',
    GOOGLE_CLIENT_SECRET: 'segredo-teste',
    SESSION_SECRET: 'segredo-de-sessao-para-testes',
    OWNER_EMAIL: 'marco@gmail.com',
    MODELO_PADRAO: 'claude-haiku-5-5',
    MODELO_PROFUNDO: 'claude-sonnet-5-5',
    LIMITE_MENSAGENS_DIA: '200',
    ...extra,
  };
}

/** Provedor de login simulado: devolve o perfil configurado ou falha. */
export function provedorFalso(perfil: PerfilGoogle | Error): ProvedorOAuth {
  return {
    urlAutorizacao: (state) => new URL(`https://accounts.google.test/auth?state=${state}`),
    obterPerfil: async () => {
      if (perfil instanceof Error) throw perfil;
      return perfil;
    },
  };
}

export const PERFIL_MARCO: PerfilGoogle = { email: 'marco@gmail.com', emailVerificado: true, nome: 'Marco', fotoUrl: 'https://foto/m.png' };

export function criarAppTeste(opcoes: { perfil?: PerfilGoogle | Error; agora?: () => Date; env?: Partial<Ambiente>; transcritor?: Transcritor } = {}) {
  const env = criarAmbienteTeste(opcoes.env);
  const deps: Dependencias = {
    agora: opcoes.agora ?? (() => new Date()),
    provedorOAuth: () => provedorFalso(opcoes.perfil ?? PERFIL_MARCO),
    transcritor: () => opcoes.transcritor,
  };
  const app = criarApp(deps);
  const chamar = (caminho: string, init: RequestInit = {}) => app.request(`${URL_TESTE}${caminho}`, init, env);
  return { app, env, chamar, deps };
}

/** Extrai `nome=valor` dos Set-Cookie de uma resposta, para reenviar como Cookie. */
export function cookiesDe(resp: Response): string {
  return resp.headers
    .getSetCookie()
    .map((c) => c.split(';')[0]!)
    .filter((c) => !c.endsWith('='))
    .join('; ');
}

/** Faz o fluxo completo de login (início + retorno) e devolve o cookie de sessão. */
export async function entrar(t: ReturnType<typeof criarAppTeste>, voltar?: string) {
  const inicio = await t.chamar(`/auth/google${voltar ? `?voltar=${encodeURIComponent(voltar)}` : ''}`);
  const state = new URL(inicio.headers.get('location')!).searchParams.get('state')!;
  const retorno = await t.chamar(`/auth/google/callback?code=abc&state=${state}`, { headers: { cookie: cookiesDe(inicio) } });
  return { inicio, retorno, cookie: cookiesDe(retorno) };
}
