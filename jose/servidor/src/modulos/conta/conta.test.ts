import { describe, expect, it } from 'vitest';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';

const post = (t: ReturnType<typeof criarAppTeste>, caminho: string, cookie?: string) =>
  t.chamar(caminho, { method: 'POST', headers: { origin: URL_TESTE, ...(cookie ? { cookie } : {}) } });

describe('GET /api/eu', () => {
  it('sem sessão → 401', async () => {
    const t = criarAppTeste();
    expect((await t.chamar('/api/eu')).status).toBe(401);
  });
  it('devolve os dados do Marco logado', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    const r = await t.chamar('/api/eu', { headers: { cookie } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ nome: 'Marco', email: 'marco@gmail.com', foto_url: 'https://foto/m.png', boas_vindas_concluida: false, fuso_horario: 'America/Sao_Paulo' });
  });
  it('inclui a conversa de boas-vindas em aberto', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    const u = await t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>();
    const ag = new Date().toISOString();
    await t.env.DB.prepare("INSERT INTO conversas(id,usuario_id,tipo,criada_em,atualizada_em) VALUES('cb',?,'boas_vindas',?,?)").bind(u!.id, ag, ag).run();
    const j = (await (await t.chamar('/api/eu', { headers: { cookie } })).json()) as Record<string, unknown>;
    expect(j.conversa_boas_vindas_id).toBe('cb');
  });
});

describe('POST /auth/sair', () => {
  it('apaga só a sessão atual e limpa o cookie', async () => {
    const t = criarAppTeste();
    const a = await entrar(t);
    const b = await entrar(t);
    const r = await post(t, '/auth/sair', a.cookie);
    expect(r.status).toBe(204);
    expect(r.headers.getSetCookie().join()).toMatch(/jose_sessao=;/);
    expect((await t.chamar('/api/eu', { headers: { cookie: a.cookie } })).status).toBe(401);
    expect((await t.chamar('/api/eu', { headers: { cookie: b.cookie } })).status).toBe(200);
  });
  it('exige Origin correto', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    const r = await t.chamar('/auth/sair', { method: 'POST', headers: { cookie, origin: 'https://evil.example' } });
    expect(r.status).toBe(403);
  });
});

describe('POST /auth/sair-todos', () => {
  it('depois de sair de todos, cookies antigos recebem 401', async () => {
    const t = criarAppTeste();
    const a = await entrar(t);
    const b = await entrar(t);
    expect((await t.chamar('/api/eu', { headers: { cookie: b.cookie } })).status).toBe(200);
    const r = await post(t, '/auth/sair-todos', a.cookie);
    expect(r.status).toBe(204);
    expect((await t.chamar('/api/eu', { headers: { cookie: a.cookie } })).status).toBe(401);
    expect((await t.chamar('/api/eu', { headers: { cookie: b.cookie } })).status).toBe(401);
    const n = await t.env.DB.prepare('SELECT COUNT(*) AS n FROM sessoes').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
  it('sem sessão → 401', async () => {
    const t = criarAppTeste();
    expect((await post(t, '/auth/sair-todos')).status).toBe(401);
  });
});
