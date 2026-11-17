import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { criarAmbienteTeste, URL_TESTE } from '../../../testes/ambiente';
import { sha256Hex } from '../../compartilhado/cripto';
import { tratarErro } from '../../compartilhado/erros';
import { buscarDoUsuario } from '../../compartilhado/posse';
import { checarOrigem, exigirSessao, type AppEnv } from './sessao';
import { concluirLogin, MS_SESSAO } from './servico';
import { PERFIL_MARCO } from '../../../testes/ambiente';

const T0 = new Date('2026-11-17T12:00:00Z');

function montar() {
  let agora = T0;
  const env = criarAmbienteTeste();
  const app = new Hono<AppEnv>();
  app.onError(tratarErro);
  app.use('/api/*', checarOrigem, exigirSessao({ agora: () => agora }));
  app.get('/api/quem', (c) => c.json({ id: c.var.usuario.id }));
  app.post('/api/escrever', (c) => c.json({ ok: true }));
  const chamar = (m: string, caminho: string, cookie?: string, origem?: string) =>
    app.request(`${URL_TESTE}${caminho}`, { method: m, headers: { ...(cookie ? { cookie: `jose_sessao=${cookie}` } : {}), ...(origem ? { origin: origem } : {}) } }, env);
  return { env, chamar, relogio: (d: Date) => (agora = d) };
}

describe('middleware de sessão', () => {
  it('sem cookie → 401 no formato padrão', async () => {
    const t = montar();
    const r = await t.chamar('GET', '/api/quem');
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: { codigo: 'nao_autenticado', mensagem: expect.any(String) } });
  });

  it('cookie desconhecido → 401', async () => {
    const t = montar();
    expect((await t.chamar('GET', '/api/quem', 'token-falso')).status).toBe(401);
  });

  it('sessão válida → 200 com o usuário da sessão; guarda só o hash no banco', async () => {
    const t = montar();
    const l = await concluirLogin(t.env.DB, PERFIL_MARCO, 'marco@gmail.com', T0);
    if (!l.ok) throw new Error();
    const r = await t.chamar('GET', '/api/quem', l.token);
    expect(r.status).toBe(200);
    expect((await r.json() as { id: string }).id).toBe(l.usuarioId);
    const s = await t.env.DB.prepare('SELECT id FROM sessoes').first<{ id: string }>();
    expect(s?.id).toBe(await sha256Hex(l.token));
    expect(s?.id).not.toBe(l.token);
  });

  it('cookie expirado → 401 e a sessão é apagada', async () => {
    const t = montar();
    const l = await concluirLogin(t.env.DB, PERFIL_MARCO, 'marco@gmail.com', T0);
    if (!l.ok) throw new Error();
    t.relogio(new Date(T0.getTime() + MS_SESSAO + 1000));
    expect((await t.chamar('GET', '/api/quem', l.token)).status).toBe(401);
    const n = await t.env.DB.prepare('SELECT COUNT(*) AS n FROM sessoes').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it('renova por 30 dias no uso (e renova o cookie)', async () => {
    const t = montar();
    const l = await concluirLogin(t.env.DB, PERFIL_MARCO, 'marco@gmail.com', T0);
    if (!l.ok) throw new Error();
    const depois = new Date(T0.getTime() + 20 * 86_400_000);
    t.relogio(depois);
    const r = await t.chamar('GET', '/api/quem', l.token);
    expect(r.status).toBe(200);
    expect(r.headers.getSetCookie().some((c) => c.startsWith('jose_sessao='))).toBe(true);
    const s = await t.env.DB.prepare('SELECT expira_em FROM sessoes').first<{ expira_em: string }>();
    expect(s?.expira_em).toBe(new Date(depois.getTime() + MS_SESSAO).toISOString());
    // sem a renovação a sessão teria acabado no dia 30; agora segue válida no dia 45
    t.relogio(new Date(T0.getTime() + 45 * 86_400_000));
    expect((await t.chamar('GET', '/api/quem', l.token)).status).toBe(200);
  });
});

describe('checagem de Origin nas escritas', () => {
  it('POST com outra origem → 403; sem Origin → 403; origem certa → 200', async () => {
    const t = montar();
    const l = await concluirLogin(t.env.DB, PERFIL_MARCO, 'marco@gmail.com', T0);
    if (!l.ok) throw new Error();
    const ruim = await t.chamar('POST', '/api/escrever', l.token, 'https://evil.example');
    expect(ruim.status).toBe(403);
    expect((await ruim.json() as { erro: { codigo: string } }).erro.codigo).toBe('origem_invalida');
    expect((await t.chamar('POST', '/api/escrever', l.token)).status).toBe(403);
    expect((await t.chamar('POST', '/api/escrever', l.token, URL_TESTE)).status).toBe(200);
  });
  it('GET não exige Origin', async () => {
    const t = montar();
    const l = await concluirLogin(t.env.DB, PERFIL_MARCO, 'marco@gmail.com', T0);
    if (!l.ok) throw new Error();
    expect((await t.chamar('GET', '/api/quem', l.token)).status).toBe(200);
  });
});

describe('helper de posse', () => {
  it('devolve 404 para item de outro usuário e para id inexistente', async () => {
    const t = montar();
    const db = t.env.DB;
    const agora = T0.toISOString();
    await db.prepare('INSERT INTO usuarios(id,email,nome,criado_em) VALUES(?,?,?,?),(?,?,?,?)').bind('u1', 'a@x', 'A', agora, 'u2', 'b@x', 'B', agora).run();
    await db.prepare('INSERT INTO tarefas(id,usuario_id,titulo,area,origem,criada_em) VALUES(?,?,?,?,?,?)').bind('t1', 'u1', 'x', 'casa', 'manual', agora).run();
    await expect(buscarDoUsuario(db, 'tarefas', 't1', 'u1')).resolves.toMatchObject({ id: 't1' });
    await expect(buscarDoUsuario(db, 'tarefas', 't1', 'u2')).rejects.toMatchObject({ status: 404 });
    await expect(buscarDoUsuario(db, 'tarefas', 'nao-existe', 'u1')).rejects.toMatchObject({ status: 404 });
  });
});
