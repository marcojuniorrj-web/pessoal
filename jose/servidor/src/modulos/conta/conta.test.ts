import { describe, expect, it } from 'vitest';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';
import { contarTabelas, semearUsuario } from '../../../testes/semear';

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

describe('DELETE /api/eu (apagar todos os meus dados)', () => {
  const TABELAS = ['conversas', 'memorias', 'mensagens', 'metas', 'sessoes', 'sugestoes', 'tarefas', 'uso_diario', 'usuarios'];
  const apagar = (t: ReturnType<typeof criarAppTeste>, cookie: string | undefined, corpo: unknown, origin: string | null = URL_TESTE) =>
    t.chamar('/api/eu', {
      method: 'DELETE',
      headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });

  async function cenario() {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    const marco = await t.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind('marco@gmail.com').first<{ id: string }>();
    // Preenche TODAS as tabelas do Marco e de um segundo usuário (que não pode ser tocado).
    await t.env.DB.prepare("INSERT INTO conversas(id,usuario_id,titulo,tipo,criada_em,atualizada_em) VALUES('mc',?, 'x','normal','2026-11-18T12:00:00Z','2026-11-18T12:00:00Z')").bind(marco!.id).run();
    await t.env.DB.prepare("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES('mm1','mc','jose','oi','texto','2026-11-18T12:00:00Z')").run();
    await t.env.DB.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,criada_em) VALUES('ms1','mm1','memoria','{}','2026-11-18T12:00:00Z')").run();
    await t.env.DB.prepare("INSERT INTO tarefas(id,usuario_id,titulo,area,origem,criada_em) VALUES('mt',?, 't','casa','manual','2026-11-18T12:00:00Z')").bind(marco!.id).run();
    await t.env.DB.prepare("INSERT INTO metas(id,usuario_id,titulo,area,origem,criada_em) VALUES('mg',?, 'g','casa','manual','2026-11-18T12:00:00Z')").bind(marco!.id).run();
    await t.env.DB.prepare("INSERT INTO memorias(id,usuario_id,texto,area,origem,criada_em) VALUES('mmem',?, 'm','casa','manual','2026-11-18T12:00:00Z')").bind(marco!.id).run();
    await t.env.DB.prepare("INSERT INTO uso_diario(usuario_id,dia,respostas,transcricoes) VALUES(?, '2026-11-18', 5, 1)").bind(marco!.id).run();
    const outro = await semearUsuario(t.env.DB, 'outro', 'outro@gmail.com');
    return { t, cookie, marcoId: marco!.id, outro };
  }

  it('as tabelas conhecidas no teste são todas as do banco (migração nova obriga atualizar o apagar tudo)', async () => {
    const t = criarAppTeste();
    expect(Object.keys(await contarTabelas(t.env.DB)).sort()).toEqual(TABELAS);
  });

  it('com {confirmacao: "APAGAR"} não sobra nenhuma linha do usuário em nenhuma tabela, limpa o cookie e não toca em outro usuário', async () => {
    const { t, cookie, marcoId, outro } = await cenario();
    const antes = await contarTabelas(t.env.DB, { usuarioId: marcoId });
    for (const tabela of TABELAS) expect(antes[tabela], `semeado em ${tabela}`).toBeGreaterThan(0);
    const outroAntes = await contarTabelas(t.env.DB, { usuarioId: outro.usuarioId });

    const r = await apagar(t, cookie, { confirmacao: 'APAGAR' });
    expect(r.status).toBe(204);
    expect(r.headers.getSetCookie().join()).toMatch(/jose_sessao=;/);

    const depois = await contarTabelas(t.env.DB, { usuarioId: marcoId });
    for (const tabela of TABELAS) expect(depois[tabela], `sobrou em ${tabela}`).toBe(0);
    expect(await contarTabelas(t.env.DB, { usuarioId: outro.usuarioId })).toEqual(outroAntes);
    // Totais: só restam as linhas do outro usuário.
    const total = await contarTabelas(t.env.DB);
    for (const tabela of TABELAS) expect(total[tabela]).toBe(outroAntes[tabela]);
    // O cookie antigo não vale mais.
    expect((await t.chamar('/api/eu', { headers: { cookie } })).status).toBe(401);
  });

  it.each([
    ['sem corpo', undefined],
    ['corpo vazio', {}],
    ['minúsculas', { confirmacao: 'apagar' }],
    ['com espaço', { confirmacao: 'APAGAR ' }],
    ['outra palavra', { confirmacao: 'SIM' }],
    ['tipo errado', { confirmacao: true }],
  ])('400 e nada é apagado: %s', async (_nome, corpo) => {
    const { t, cookie, marcoId } = await cenario();
    const antes = await contarTabelas(t.env.DB, { usuarioId: marcoId });
    const r = await apagar(t, cookie, corpo);
    expect(r.status).toBe(400);
    expect(r.headers.getSetCookie().join()).not.toMatch(/jose_sessao=;/);
    expect(await contarTabelas(t.env.DB, { usuarioId: marcoId })).toEqual(antes);
    expect((await t.chamar('/api/eu', { headers: { cookie } })).status).toBe(200);
  });

  it('exige Origin válido (ausente ou de outro site → 403, nada apagado)', async () => {
    const { t, cookie, marcoId } = await cenario();
    const antes = await contarTabelas(t.env.DB, { usuarioId: marcoId });
    expect((await apagar(t, cookie, { confirmacao: 'APAGAR' }, 'https://evil.example')).status).toBe(403);
    expect((await apagar(t, cookie, { confirmacao: 'APAGAR' }, null)).status).toBe(403);
    expect(await contarTabelas(t.env.DB, { usuarioId: marcoId })).toEqual(antes);
  });

  it('sem sessão → 401', async () => {
    const { t } = await cenario();
    expect((await apagar(t, undefined, { confirmacao: 'APAGAR' })).status).toBe(401);
  });

  it('é uma transação: se uma exclusão falha no meio, nada é apagado', async () => {
    const { t, cookie, marcoId } = await cenario();
    const antes = await contarTabelas(t.env.DB, { usuarioId: marcoId });
    // Sabota a última etapa (apagar o usuário) com um gatilho que aborta.
    await t.env.DB.exec("CREATE TRIGGER barra BEFORE DELETE ON usuarios BEGIN SELECT RAISE(ABORT, 'falha de teste'); END");
    const r = await apagar(t, cookie, { confirmacao: 'APAGAR' });
    expect(r.status).toBe(500);
    expect(await contarTabelas(t.env.DB, { usuarioId: marcoId })).toEqual(antes);
  });
});
