import { describe, expect, it } from 'vitest';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';

type T = ReturnType<typeof criarAppTeste>;
const chamar = (t: T, cookie: string, caminho: string, metodo = 'POST', corpo?: unknown) =>
  t.chamar(caminho, {
    method: metodo,
    headers: { cookie, origin: URL_TESTE, ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

const MEMORIA = { texto: 'Acorda às 6h.', area: 'saude' };

async function preparar(opcoes: { conversaTipo?: 'normal' | 'boas_vindas'; tipo?: 'tarefa' | 'meta' | 'memoria'; conteudo?: unknown } = {}) {
  const t = criarAppTeste({ agora: () => new Date('2026-11-18T10:00:00Z') });
  const { cookie } = await entrar(t);
  const dono = (await t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
  const db = t.env.DB;
  await db.prepare("INSERT INTO conversas(id,usuario_id,titulo,tipo,modo,criada_em,atualizada_em) VALUES('c1',?,NULL,?,'padrao','2026-11-18T09:00:00Z','2026-11-18T09:00:00Z')").bind(dono, opcoes.conversaTipo ?? 'normal').run();
  await db.prepare("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES('m1','c1','jose','Anotei.','texto','2026-11-18T09:00:00Z')").run();
  await db.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,status,criada_em) VALUES('s1','m1',?,?,'pendente','2026-11-18T09:00:00Z')").bind(opcoes.tipo ?? 'memoria', JSON.stringify(opcoes.conteudo ?? MEMORIA)).run();
  const sugestao = () => db.prepare("SELECT status, item_id, conteudo FROM sugestoes WHERE id='s1'").first<{ status: string; item_id: string | null; conteudo: string }>();
  const memorias = async () => (await db.prepare('SELECT * FROM memorias ORDER BY rowid').all<Record<string, unknown>>()).results;
  return { t, cookie, dono, sugestao, memorias };
}

describe('POST /api/sugestoes/:id/salvar (4.2)', () => {
  it('cria a memória com origem chat, grava o item_id e passa a sugestão para salva', async () => {
    const x = await preparar();
    const r = await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar');
    expect(r.status).toBe(200);
    const { item } = (await r.json()) as { item: Record<string, unknown> };
    expect(item).toMatchObject({ texto: 'Acorda às 6h.', area: 'saude', origem: 'chat', criada_em: '2026-11-18T10:00:00.000Z', atualizada_em: null });
    expect(item).not.toHaveProperty('usuario_id');
    expect(await x.sugestao()).toMatchObject({ status: 'salva', item_id: item.id });
    expect(await x.memorias()).toEqual([expect.objectContaining({ id: item.id, usuario_id: x.dono, texto: 'Acorda às 6h.', origem: 'chat' })]);
    // aparece em GET /api/memorias (a tela José sabe) e, portanto, no contexto das próximas respostas
    expect(((await (await chamar(x.t, x.cookie, '/api/memorias', 'GET')).json()) as Array<{ id: string }>).map((m) => m.id)).toEqual([item.id]);
  });

  it('com `conteudo` editado salva o texto editado (e guarda a edição na sugestão)', async () => {
    const x = await preparar();
    const r = await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar', 'POST', { conteudo: { texto: '  Acorda às 5h30.  ', area: 'sobre_mim' } });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ item: { texto: 'Acorda às 5h30.', area: 'sobre_mim' } });
    expect(JSON.parse((await x.sugestao())!.conteudo)).toEqual({ texto: 'Acorda às 5h30.', area: 'sobre_mim' });
  });

  it('conteúdo editado inválido → 400, nada é criado e a sugestão continua pendente', async () => {
    const x = await preparar();
    for (const conteudo of [{ texto: 'x'.repeat(301), area: 'casa' }, { texto: '', area: 'casa' }, { texto: 'ok', area: 'nada' }, { texto: 'ok' }, 'texto solto']) {
      const r = await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar', 'POST', { conteudo });
      expect(r.status, JSON.stringify(conteudo)).toBe(400);
    }
    expect((await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar', 'POST', [1])).status).toBe(400);
    expect((await x.sugestao())!.status).toBe('pendente');
    expect(await x.memorias()).toEqual([]);
  });

  it('corpo que não é JSON → 400 e nada é salvo', async () => {
    const x = await preparar();
    const r = await x.t.chamar('/api/sugestoes/s1/salvar', { method: 'POST', headers: { cookie: x.cookie, origin: URL_TESTE, 'content-type': 'application/json' }, body: '{quebrado' });
    expect(r.status).toBe(400);
    expect((await x.sugestao())!.status).toBe('pendente');
    expect(await x.memorias()).toEqual([]);
  });

  it('salvar duas vezes → 409 na segunda, sem duplicar a memória', async () => {
    const x = await preparar();
    expect((await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar')).status).toBe(200);
    const segunda = await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar');
    expect(segunda.status).toBe(409);
    expect(((await segunda.json()) as { erro: { codigo: string } }).erro.codigo).toBe('sugestao_ja_tratada');
    expect(await x.memorias()).toHaveLength(1);
  });

  it('dois toques ao mesmo tempo: um vence (200) e o outro leva 409', async () => {
    const x = await preparar();
    const respostas = await Promise.all([chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar'), chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar')]);
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await x.memorias()).toHaveLength(1);
  });

  it('conversa de boas-vindas → origem boas_vindas', async () => {
    const x = await preparar({ conversaTipo: 'boas_vindas' });
    expect(await (await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar')).json()).toMatchObject({ item: { origem: 'boas_vindas' } });
  });

  it('depois de descartada, não salva (409)', async () => {
    const x = await preparar();
    await chamar(x.t, x.cookie, '/api/sugestoes/s1/descartar');
    expect((await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar')).status).toBe(409);
    expect(await x.memorias()).toEqual([]);
  });

  it('tarefa e meta ainda não são salvas (onda 5): 400 e continuam pendentes', async () => {
    const x = await preparar({ tipo: 'tarefa', conteudo: { titulo: 'Ligar para o João', area: 'trabalho' } });
    expect((await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar')).status).toBe(400);
    expect((await x.sugestao())!.status).toBe('pendente');
  });

  it('posse: sugestão de outro usuário ou inexistente → 404 igual, e nada muda', async () => {
    const x = await preparar();
    await x.t.env.DB.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('outro','outro@x.com','Outro','2026-01-01T00:00:00Z')").run();
    await x.t.env.DB.prepare("INSERT INTO conversas(id,usuario_id,titulo,tipo,modo,criada_em,atualizada_em) VALUES('c2','outro',NULL,'normal','padrao','2026-11-18T09:00:00Z','2026-11-18T09:00:00Z')").run();
    await x.t.env.DB.prepare("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES('m2','c2','jose','x','texto','2026-11-18T09:00:00Z')").run();
    await x.t.env.DB.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,status,criada_em) VALUES('alheia','m2','memoria','{\"texto\":\"Segredo\",\"area\":\"casa\"}','pendente','2026-11-18T09:00:00Z')").run();
    for (const id of ['alheia', 'nao-existe']) {
      for (const acao of ['salvar', 'descartar']) {
        const r = await chamar(x.t, x.cookie, `/api/sugestoes/${id}/${acao}`);
        expect(r.status, `${id}/${acao}`).toBe(404);
      }
    }
    expect(await x.t.env.DB.prepare("SELECT status FROM sugestoes WHERE id='alheia'").first()).toEqual({ status: 'pendente' });
    expect(await x.memorias()).toEqual([]);
  });

  it('exige sessão (401) e Origin correto (403)', async () => {
    const x = await preparar();
    expect((await x.t.chamar('/api/sugestoes/s1/salvar', { method: 'POST', headers: { origin: URL_TESTE } })).status).toBe(401);
    expect((await x.t.chamar('/api/sugestoes/s1/salvar', { method: 'POST', headers: { cookie: x.cookie, origin: 'https://outro.site' } })).status).toBe(403);
  });
});

describe('POST /api/sugestoes/:id/descartar (4.2)', () => {
  it('descarta a pendente (204) e não cria nada', async () => {
    const x = await preparar();
    expect((await chamar(x.t, x.cookie, '/api/sugestoes/s1/descartar')).status).toBe(204);
    expect(await x.sugestao()).toMatchObject({ status: 'descartada', item_id: null });
    expect(await x.memorias()).toEqual([]);
  });

  it('descartar de novo ou descartar uma já salva → 409', async () => {
    const x = await preparar();
    await chamar(x.t, x.cookie, '/api/sugestoes/s1/descartar');
    expect((await chamar(x.t, x.cookie, '/api/sugestoes/s1/descartar')).status).toBe(409);
    const y = await preparar();
    await chamar(y.t, y.cookie, '/api/sugestoes/s1/salvar');
    expect((await chamar(y.t, y.cookie, '/api/sugestoes/s1/descartar')).status).toBe(409);
    expect((await y.sugestao())!.status).toBe('salva');
  });
});

describe('sugestões na conversa (cartões ao reabrir)', () => {
  it('GET /api/conversas/:id devolve a sugestão com status e item_id', async () => {
    const x = await preparar();
    await chamar(x.t, x.cookie, '/api/sugestoes/s1/salvar');
    const dados = (await (await chamar(x.t, x.cookie, '/api/conversas/c1', 'GET')).json()) as { sugestoes: Array<Record<string, unknown>> };
    expect(dados.sugestoes).toEqual([expect.objectContaining({ id: 's1', mensagem_id: 'm1', tipo: 'memoria', status: 'salva', conteudo: MEMORIA })]);
    expect(dados.sugestoes[0]!.item_id).toBeTruthy();
  });
});
