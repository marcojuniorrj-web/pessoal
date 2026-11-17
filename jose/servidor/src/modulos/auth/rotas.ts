import { generateCodeVerifier, generateState } from 'arctic';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { assinar, sha256Hex, verificar } from '../../compartilhado/cripto';
import { urlBase, type Dependencias } from '../../compartilhado/dependencias';
import { COOKIE_OAUTH, COOKIE_SESSAO, opcoesCookie, voltarSeguro } from './cookies';
import { exigirSessao, type AppEnv } from './sessao';
import { concluirLogin, MS_SESSAO, sair, sairDeTodos } from './servico';

export function rotasAuth(deps: Dependencias) {
  const rotas = new Hono<AppEnv>();

  rotas.get('/google', async (c) => {
    const state = generateState();
    const verifier = generateCodeVerifier();
    const voltar = voltarSeguro(c.req.query('voltar'));
    const retorno = `${urlBase(c.env, c.req.url)}/auth/google/callback`;
    const url = deps.provedorOAuth(c.env, retorno).urlAutorizacao(state, verifier);
    const valor = await assinar(JSON.stringify({ state, verifier, voltar }), c.env.SESSION_SECRET);
    setCookie(c, COOKIE_OAUTH, valor, opcoesCookie(c.req.url, 600));
    return c.redirect(url.toString(), 302);
  });

  rotas.get('/google/callback', async (c) => {
    const bruto = getCookie(c, COOKIE_OAUTH);
    deleteCookie(c, COOKIE_OAUTH, { path: '/' });
    const falha = () => c.redirect('/?erro=falha', 302);
    try {
      if (c.req.query('error')) return falha();
      const code = c.req.query('code');
      const state = c.req.query('state');
      if (!bruto || !code || !state) return falha();
      const json = await verificar(bruto, c.env.SESSION_SECRET);
      if (!json) return falha();
      const guardado = JSON.parse(json) as { state: string; verifier: string; voltar: string };
      if (guardado.state !== state) return falha();

      const retorno = `${urlBase(c.env, c.req.url)}/auth/google/callback`;
      const perfil = await deps.provedorOAuth(c.env, retorno).obterPerfil(code, guardado.verifier);
      const login = await concluirLogin(c.env.DB, perfil, c.env.OWNER_EMAIL, deps.agora());
      if (!login.ok) return c.redirect('/?erro=negado', 302);

      setCookie(c, COOKIE_SESSAO, login.token, opcoesCookie(c.req.url, MS_SESSAO / 1000));
      return c.redirect(voltarSeguro(guardado.voltar), 302);
    } catch (e) {
      console.error('erro no login Google', e instanceof Error ? e.name : 'desconhecido');
      return falha();
    }
  });

  // Sair deste aparelho: apaga a sessão atual (e o cookie), mesmo que já tenha expirado.
  rotas.post('/sair', async (c) => {
    const token = getCookie(c, COOKIE_SESSAO);
    if (token) await sair(c.env.DB, await sha256Hex(token));
    deleteCookie(c, COOKIE_SESSAO, { path: '/' });
    return c.body(null, 204);
  });

  // Sair de todos os aparelhos: apaga todas as sessões do usuário.
  rotas.post('/sair-todos', exigirSessao(deps), async (c) => {
    await sairDeTodos(c.env.DB, c.var.usuario.id);
    deleteCookie(c, COOKIE_SESSAO, { path: '/' });
    return c.body(null, 204);
  });

  return rotas;
}
