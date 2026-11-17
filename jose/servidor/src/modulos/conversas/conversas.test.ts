import { describe, expect, it } from 'vitest';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';

type T = ReturnType<typeof criarAppTeste>;
const sp = (iso: string) => new Date(`${iso}-03:00`);

const chamar = (t: T, cookie: string, caminho: string, metodo = 'GET', corpo?: unknown) =>
  t.chamar(caminho, {
    method: metodo,
    headers: { cookie, origin: URL_TESTE, ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

async function usuarioId(t: T) {
  return (await t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
}
async function inserirConversa(t: T, dono: string, id: string, atualizada: string, extra: { tipo?: string; titulo?: string | null; modo?: string } = {}) {
  await t.env.DB
    .prepare('INSERT INTO conversas(id,usuario_id,titulo,tipo,modo,criada_em,atualizada_em) VALUES(?,?,?,?,?,?,?)')
    .bind(id, dono, extra.titulo ?? null, extra.tipo ?? 'normal', extra.modo ?? 'padrao', atualizada, atualizada)
    .run();
}
async function inserirMensagem(t: T, conversa: string, id: string, autor: 'marco' | 'jose', texto: string, criada: string) {
  await t.env.DB
    .prepare('INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES(?,?,?,?,?,?)')
    .bind(id, conversa, autor, texto, 'texto', criada)
    .run();
}
async function outroUsuario(t: T) {
  await t.env.DB.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('outro','outro@x.com','Outro','2026-01-01T00:00:00Z')").run();
  await inserirConversa(t, 'outro', 'conv-alheia', '2026-11-17T12:00:00.000Z', { titulo: 'Segredo' });
  await inserirMensagem(t, 'conv-alheia', 'm-alheia', 'marco', 'segredo', '2026-11-17T12:00:00.000Z');
}

describe('POST /api/conversas', () => {
  it('cria conversa normal (modo padrão) e de decisão', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    const a = await chamar(t, cookie, '/api/conversas', 'POST', { tipo: 'normal' });
    expect(a.status).toBe(201);
    const { id } = (await a.json()) as { id: string };
    const b = (await (await chamar(t, cookie, '/api/conversas', 'POST', { tipo: 'normal', modo: 'decidir' })).json()) as { id: string };
    const linhas = await t.env.DB.prepare('SELECT id, modo, tipo, titulo, usuario_id FROM conversas ORDER BY rowid').all<Record<string, string | null>>();
    expect(linhas.results).toEqual([
      { id, modo: 'padrao', tipo: 'normal', titulo: null, usuario_id: await usuarioId(t) },
      { id: b.id, modo: 'decidir', tipo: 'normal', titulo: null, usuario_id: await usuarioId(t) },
    ]);
  });
  it('valida o corpo, exige sessão e Origin', async () => {
    const t = criarAppTeste();
    expect((await t.chamar('/api/conversas', { method: 'POST', headers: { origin: URL_TESTE } })).status).toBe(401);
    const { cookie } = await entrar(t);
    expect((await chamar(t, cookie, '/api/conversas', 'POST', { tipo: 'outro' })).status).toBe(400);
    expect((await chamar(t, cookie, '/api/conversas', 'POST', { tipo: 'normal', modo: 'x' })).status).toBe(400);
    expect((await t.chamar('/api/conversas', { method: 'POST', headers: { cookie, origin: 'https://evil.dev', 'content-type': 'application/json' }, body: '{"tipo":"normal"}' })).status).toBe(403);
  });
});

describe('GET /api/conversas', () => {
  it('lista só as do usuário, da mais recente para a mais antiga', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    const u = await usuarioId(t);
    await inserirConversa(t, u, 'c1', '2026-11-10T12:00:00.000Z', { titulo: 'Velha' });
    await inserirConversa(t, u, 'c2', '2026-11-17T12:00:00.000Z', { titulo: 'Nova', modo: 'decidir' });
    await outroUsuario(t);
    const r = await chamar(t, cookie, '/api/conversas');
    expect(await r.json()).toEqual([
      { id: 'c2', titulo: 'Nova', tipo: 'normal', modo: 'decidir', atualizada_em: '2026-11-17T12:00:00.000Z' },
      { id: 'c1', titulo: 'Velha', tipo: 'normal', modo: 'padrao', atualizada_em: '2026-11-10T12:00:00.000Z' },
    ]);
  });
});

describe('GET /api/conversas/hoje (regra 12, relógio fixo)', () => {
  const montar = async (agora: Date) => {
    const t = criarAppTeste({ agora: () => agora });
    const { cookie } = await entrar(t);
    return { t, cookie, u: await usuarioId(t) };
  };

  it('devolve a última conversa normal atualizada hoje, com mensagens e sugestões', async () => {
    const { t, cookie, u } = await montar(sp('2026-11-17T10:00:00'));
    await inserirConversa(t, u, 'antiga', sp('2026-11-16T09:00:00').toISOString());
    await inserirConversa(t, u, 'hoje', sp('2026-11-17T08:00:00').toISOString(), { titulo: 'Plano do dia' });
    await inserirMensagem(t, 'hoje', 'm1', 'marco', 'oi', sp('2026-11-17T08:00:00').toISOString());
    await inserirMensagem(t, 'hoje', 'm2', 'jose', 'Bom dia, Marco.', sp('2026-11-17T08:00:01').toISOString());
    await t.env.DB.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,criada_em) VALUES('s1','m2','tarefa','{\"titulo\":\"X\",\"area\":\"casa\"}','2026-11-17T11:00:00Z')").run();
    const j = (await (await chamar(t, cookie, '/api/conversas/hoje')).json()) as { conversa: { id: string; titulo: string }; mensagens: { id: string }[]; sugestoes: unknown[] };
    expect(j.conversa).toMatchObject({ id: 'hoje', titulo: 'Plano do dia' });
    expect(j.mensagens.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(j.sugestoes).toEqual([{ id: 's1', mensagem_id: 'm2', tipo: 'tarefa', conteudo: { titulo: 'X', area: 'casa' }, status: 'pendente', item_id: null }]);
    expect(j.mensagens[0]).not.toHaveProperty('tokens_entrada');
  });

  it('null quando a última conversa é de ontem ou não existe', async () => {
    const { t, cookie, u } = await montar(sp('2026-11-17T10:00:00'));
    expect(await (await chamar(t, cookie, '/api/conversas/hoje')).json()).toBeNull();
    await inserirConversa(t, u, 'ontem', sp('2026-11-16T23:00:00').toISOString());
    expect(await (await chamar(t, cookie, '/api/conversas/hoje')).json()).toBeNull();
  });

  it('ignora conversas de boas-vindas', async () => {
    const { t, cookie, u } = await montar(sp('2026-11-17T10:00:00'));
    await inserirConversa(t, u, 'bv', sp('2026-11-17T09:00:00').toISOString(), { tipo: 'boas_vindas' });
    expect(await (await chamar(t, cookie, '/api/conversas/hoje')).json()).toBeNull();
  });

  it('o dia vira à meia-noite do fuso do Marco, não à do UTC', async () => {
    // 23h30 em SP (02h30 UTC do dia seguinte) ainda é "hoje"; 00h30 do dia seguinte já não é.
    const conversa = sp('2026-11-17T22:00:00').toISOString();
    const antes = await montar(sp('2026-11-17T23:30:00'));
    await inserirConversa(antes.t, antes.u, 'c', conversa);
    expect(await (await chamar(antes.t, antes.cookie, '/api/conversas/hoje')).json()).not.toBeNull();
    const depois = await montar(sp('2026-11-18T00:30:00'));
    await inserirConversa(depois.t, depois.u, 'c', conversa);
    expect(await (await chamar(depois.t, depois.cookie, '/api/conversas/hoje')).json()).toBeNull();
  });
});

describe('GET /api/conversas/:id', () => {
  it('abre a conversa do usuário', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    await inserirConversa(t, await usuarioId(t), 'c1', '2026-11-17T12:00:00.000Z', { titulo: 'T' });
    await inserirMensagem(t, 'c1', 'm1', 'marco', 'oi', '2026-11-17T12:00:00.000Z');
    const j = (await (await chamar(t, cookie, '/api/conversas/c1')).json()) as { conversa: { id: string }; mensagens: unknown[] };
    expect(j.conversa.id).toBe('c1');
    expect(j.mensagens).toHaveLength(1);
  });
  it('conversa de outro usuário ou inexistente → 404 igual', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    await outroUsuario(t);
    const alheia = await chamar(t, cookie, '/api/conversas/conv-alheia');
    const nada = await chamar(t, cookie, '/api/conversas/nao-existe');
    expect(alheia.status).toBe(404);
    expect(await alheia.json()).toEqual(await nada.json());
  });
});

describe('DELETE /api/conversas/:id', () => {
  it('apaga a conversa e, em cascata, mensagens e sugestões; itens salvos ficam', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    const u = await usuarioId(t);
    await inserirConversa(t, u, 'c1', '2026-11-17T12:00:00.000Z');
    await inserirMensagem(t, 'c1', 'm1', 'jose', 'oi', '2026-11-17T12:00:00.000Z');
    await t.env.DB.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,status,item_id,criada_em) VALUES('s1','m1','tarefa','{}','salva','t1','2026-11-17T12:00:00Z')").run();
    await t.env.DB.prepare("INSERT INTO tarefas(id,usuario_id,titulo,area,origem,criada_em) VALUES('t1',?,'Salva','casa','chat','2026-11-17T12:00:00Z')").bind(u).run();
    const r = await chamar(t, cookie, '/api/conversas/c1', 'DELETE');
    expect(r.status).toBe(204);
    const n = async (tab: string) => (await t.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${tab}`).first<{ n: number }>())!.n;
    expect([await n('conversas'), await n('mensagens'), await n('sugestoes'), await n('tarefas')]).toEqual([0, 0, 0, 1]);
    expect((await chamar(t, cookie, '/api/conversas/c1')).status).toBe(404);
  });
  it('não apaga a conversa de outro usuário (404)', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    await outroUsuario(t);
    expect((await chamar(t, cookie, '/api/conversas/conv-alheia', 'DELETE')).status).toBe(404);
    const n = await t.env.DB.prepare("SELECT COUNT(*) AS n FROM conversas WHERE id='conv-alheia'").first<{ n: number }>();
    expect(n!.n).toBe(1);
  });
});
