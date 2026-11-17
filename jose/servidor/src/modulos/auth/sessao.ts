import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Ambiente } from '../../ambiente';
import { sha256Hex } from '../../compartilhado/cripto';
import { urlBase, type Dependencias } from '../../compartilhado/dependencias';
import { naoAutenticado, origemInvalida } from '../../compartilhado/erros';
import { COOKIE_SESSAO, opcoesCookie } from './cookies';
import { apagarSessao, buscarSessao, buscarUsuario, renovarSessao, type UsuarioLinha } from './repositorio';
import { MS_SESSAO } from './servico';

export type VariaveisSessao = { usuario: UsuarioLinha; sessaoHash: string };
export type AppEnv = { Bindings: Ambiente; Variables: VariaveisSessao };

const METODOS_ESCRITA = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
// Só renova quando já passou mais de 1 dia desde a última renovação (evita uma escrita por requisição).
const MS_RENOVAR_APOS = 24 * 60 * 60 * 1000;

/** CSRF: nas escritas, o cabeçalho Origin precisa ser o do próprio app. */
export const checarOrigem: MiddlewareHandler<{ Bindings: Ambiente }> = async (c, next) => {
  if (METODOS_ESCRITA.has(c.req.method)) {
    const esperado = new URL(urlBase(c.env, c.req.url)).origin;
    if (c.req.header('origin') !== esperado) throw origemInvalida();
  }
  await next();
};

/** Exige sessão válida; o usuario_id vem SEMPRE daqui, nunca do corpo. */
export function exigirSessao(deps: Pick<Dependencias, 'agora'>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getCookie(c, COOKIE_SESSAO);
    if (!token) throw naoAutenticado();
    const sessaoHash = await sha256Hex(token);
    const sessao = await buscarSessao(c.env.DB, sessaoHash);
    if (!sessao) throw naoAutenticado();
    const agora = deps.agora();
    const expira = new Date(sessao.expira_em).getTime();
    if (expira <= agora.getTime()) {
      await apagarSessao(c.env.DB, sessaoHash);
      throw naoAutenticado();
    }
    const usuario = await buscarUsuario(c.env.DB, sessao.usuario_id);
    if (!usuario) throw naoAutenticado();

    if (MS_SESSAO - (expira - agora.getTime()) > MS_RENOVAR_APOS) {
      await renovarSessao(c.env.DB, sessaoHash, new Date(agora.getTime() + MS_SESSAO));
      setCookie(c, COOKIE_SESSAO, token, opcoesCookie(c.req.url, MS_SESSAO / 1000));
    }
    c.set('usuario', usuario);
    c.set('sessaoHash', sessaoHash);
    await next();
  };
}
