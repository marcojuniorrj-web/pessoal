import { describe, expect, it } from 'vitest';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';

const sp = (iso: string) => new Date(`${iso}-03:00`);

async function preparar(inicio = '2026-11-17T10:00:00') {
  const relogio = { agora: sp(inicio) };
  const t = criarAppTeste({ agora: () => relogio.agora });
  const { cookie } = await entrar(t);
  const dono = (await t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
  const chamar = (caminho: string, metodo = 'GET', corpo?: unknown, c = cookie) =>
    t.chamar(`/api/tarefas${caminho}`, {
      method: metodo,
      headers: { cookie: c, origin: URL_TESTE, ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  const inserir = (id: string, prazo: string | null, criada: string, extra: { concluida?: boolean; concluida_em?: string; dono?: string } = {}) =>
    t.env.DB.prepare("INSERT INTO tarefas (id, usuario_id, titulo, area, prazo, concluida, concluida_em, origem, criada_em) VALUES (?, ?, ?, 'trabalho', ?, ?, ?, 'manual', ?)")
      .bind(id, extra.dono ?? dono, `Tarefa ${id}`, prazo, extra.concluida ? 1 : 0, extra.concluida_em ?? null, criada).run();
  const ids = async () => ((await (await chamar('')).json()) as Array<{ id: string }>).map((x) => x.id);
  return { t, relogio, cookie, dono, chamar, inserir, ids };
}

describe('GET /api/tarefas: ordem da regra 5 (relógio fixo, fuso do usuário)', () => {
  it('atrasadas, de hoje, futuras (mais próxima primeiro), sem prazo; depois as concluídas por concluida_em decrescente', async () => {
    const x = await preparar();
    await x.inserir('sem', null, '2026-11-01T00:00:00Z');
    await x.inserir('longe', '2026-12-25', '2026-11-01T00:00:00Z');
    await x.inserir('hoje', '2026-11-17', '2026-11-01T00:00:00Z');
    await x.inserir('perto', '2026-11-18', '2026-11-01T00:00:00Z');
    await x.inserir('atrasada', '2026-11-10', '2026-11-01T00:00:00Z');
    await x.inserir('feita-antes', '2026-11-10', '2026-11-01T00:00:00Z', { concluida: true, concluida_em: '2026-11-15T10:00:00Z' });
    await x.inserir('feita-agora', null, '2026-11-01T00:00:00Z', { concluida: true, concluida_em: '2026-11-17T12:00:00Z' });
    expect(await x.ids()).toEqual(['atrasada', 'hoje', 'perto', 'longe', 'sem', 'feita-agora', 'feita-antes']);
  });

  it('todos os desempates: a mais nova primeiro em cada grupo e entre futuras do mesmo prazo; criada_em igual → a inserida por último', async () => {
    const x = await preparar();
    await x.inserir('atr-velha', '2026-11-01', '2026-11-02T00:00:00Z');
    await x.inserir('atr-nova', '2026-11-16', '2026-11-05T00:00:00Z');
    await x.inserir('hoje-velha', '2026-11-17', '2026-11-02T00:00:00Z');
    await x.inserir('hoje-nova', '2026-11-17', '2026-11-05T00:00:00Z');
    await x.inserir('fut-20-velha', '2026-11-20', '2026-11-02T00:00:00Z');
    await x.inserir('fut-20-nova', '2026-11-20', '2026-11-05T00:00:00Z');
    await x.inserir('fut-19-velha', '2026-11-19', '2026-11-01T00:00:00Z');
    await x.inserir('sem-velha', null, '2026-11-02T00:00:00Z');
    await x.inserir('sem-nova', null, '2026-11-05T00:00:00Z');
    await x.inserir('sem-igual-1', null, '2026-11-03T00:00:00Z');
    await x.inserir('sem-igual-2', null, '2026-11-03T00:00:00Z');
    expect(await x.ids()).toEqual([
      'atr-nova', 'atr-velha', 'hoje-nova', 'hoje-velha', 'fut-19-velha', 'fut-20-nova', 'fut-20-velha', 'sem-nova', 'sem-igual-2', 'sem-igual-1', 'sem-velha',
    ]);
  });

  it('a virada do dia em São Paulo: 23h59 a tarefa é de hoje; 00h01 ela está atrasada (e a de amanhã vira a de hoje)', async () => {
    const x = await preparar('2026-11-17T23:59:00');
    await x.inserir('dia17', '2026-11-17', '2026-11-01T00:00:00Z');
    await x.inserir('dia18', '2026-11-18', '2026-11-02T00:00:00Z');
    await x.inserir('dia16', '2026-11-16', '2026-11-03T00:00:00Z');
    const grupos = async () => {
      const dia = x.relogio.agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      return Object.fromEntries(((await (await x.chamar('')).json()) as Array<{ id: string; prazo: string }>).map((t, i) => [t.id, [i, t.prazo < dia ? 'atrasada' : t.prazo === dia ? 'hoje' : 'futura']]));
    };
    expect(await grupos()).toEqual({ dia16: [0, 'atrasada'], dia17: [1, 'hoje'], dia18: [2, 'futura'] });
    x.relogio.agora = sp('2026-11-18T00:01:00');
    expect(await grupos()).toEqual({ dia16: [0, 'atrasada'], dia17: [1, 'atrasada'], dia18: [2, 'hoje'] });
    // a atrasada mais nova (dia16, criada por último) vem antes da dia17 (empate dentro do grupo = mais nova primeiro)
    expect(await x.ids()).toEqual(['dia16', 'dia17', 'dia18']);
  });

  it('"hoje" usa o fuso do usuário', async () => {
    const x = await preparar('2026-11-17T23:30:00'); // 02h30 de 18/11 em UTC e 11h30 de 18/11 em Tóquio
    await x.inserir('dia16', '2026-11-16', '2026-11-01T00:00:00Z');
    await x.inserir('dia17', '2026-11-17', '2026-11-05T00:00:00Z');
    expect(await x.ids()).toEqual(['dia16', 'dia17']); // SP: 16 atrasada antes da de hoje (17)
    await x.t.env.DB.prepare("UPDATE usuarios SET fuso_horario = 'Asia/Tokyo'").run();
    expect(await x.ids()).toEqual(['dia17', 'dia16']); // Tóquio (já é dia 18): as duas estão atrasadas e a mais nova vem primeiro
  });

  it('devolve só as tarefas do próprio usuário e nunca o usuario_id', async () => {
    const x = await preparar();
    await x.t.env.DB.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('outro','outro@x.com','Outro','2026-01-01T00:00:00Z')").run();
    await x.inserir('minha', null, '2026-11-01T00:00:00Z');
    await x.inserir('alheia', null, '2026-11-01T00:00:00Z', { dono: 'outro' });
    const corpo = (await (await x.chamar('')).json()) as Array<Record<string, unknown>>;
    expect(corpo.map((t) => t.id)).toEqual(['minha']);
    expect(corpo[0]).not.toHaveProperty('usuario_id');
    expect(corpo[0]).toEqual({ id: 'minha', titulo: 'Tarefa minha', area: 'trabalho', prazo: null, concluida: false, concluida_em: null, origem: 'manual', criada_em: '2026-11-01T00:00:00Z' });
  });
});

describe('POST /api/tarefas', () => {
  it('cria com origem manual, sem concluir, com o título aparado e o prazo opcional (201)', async () => {
    const x = await preparar();
    const r = await x.chamar('', 'POST', { titulo: '  Ligar para o banco  ', area: 'financas', prazo: '2026-11-20' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ id: expect.any(String), titulo: 'Ligar para o banco', area: 'financas', prazo: '2026-11-20', concluida: false, concluida_em: null, origem: 'manual', criada_em: '2026-11-17T13:00:00.000Z' });
    const sem = await x.chamar('', 'POST', { titulo: 'Sem prazo', area: 'casa' });
    expect(await sem.json()).toMatchObject({ prazo: null });
    expect((await x.t.env.DB.prepare('SELECT usuario_id FROM tarefas').first<{ usuario_id: string }>())!.usuario_id).toBe(x.dono);
  });

  it('ignora usuario_id e origem do corpo (o dono vem sempre da sessão)', async () => {
    const x = await preparar();
    const r = await x.chamar('', 'POST', { titulo: 'X', area: 'casa', usuario_id: 'outro', origem: 'chat', concluida: true });
    expect(await r.json()).toMatchObject({ origem: 'manual', concluida: false });
    expect((await x.t.env.DB.prepare('SELECT usuario_id FROM tarefas').first<{ usuario_id: string }>())!.usuario_id).toBe(x.dono);
  });

  it('valida: título vazio ou > 120, área inválida, prazo fora do formato ou inexistente, corpo que não é JSON → 400 e nada é criado', async () => {
    const x = await preparar();
    for (const corpo of [{ titulo: '   ', area: 'casa' }, { titulo: 'x'.repeat(121), area: 'casa' }, { titulo: 'ok', area: 'sobre_mim' }, { titulo: 'ok' }, { titulo: 'ok', area: 'casa', prazo: '20/11/2026' }, { titulo: 'ok', area: 'casa', prazo: '2026-02-30' }, { area: 'casa' }, 'texto', null]) {
      expect((await x.chamar('', 'POST', corpo)).status, JSON.stringify(corpo)).toBe(400);
    }
    const quebrado = await x.t.chamar('/api/tarefas', { method: 'POST', headers: { cookie: x.cookie, origin: URL_TESTE, 'content-type': 'application/json' }, body: '{quebrado' });
    expect(quebrado.status).toBe(400);
    expect(((await quebrado.json()) as { erro: { codigo: string } }).erro.codigo).toBe('requisicao_invalida');
    expect((await x.t.env.DB.prepare('SELECT COUNT(*) AS n FROM tarefas').first<{ n: number }>())!.n).toBe(0);
  });

  it('aceita o título de exatamente 120 caracteres', async () => {
    const x = await preparar();
    expect((await x.chamar('', 'POST', { titulo: 'x'.repeat(120), area: 'casa' })).status).toBe(201);
  });
});

describe('PATCH /api/tarefas/:id', () => {
  it('concluir grava concluida_em (agora, UTC); concluir de novo mantém o instante original; desfazer limpa', async () => {
    const x = await preparar('2026-11-17T10:00:00');
    await x.inserir('t1', null, '2026-11-01T00:00:00Z');
    const feita = await x.chamar('/t1', 'PATCH', { concluida: true });
    expect(feita.status).toBe(200);
    expect(await feita.json()).toMatchObject({ id: 't1', concluida: true, concluida_em: '2026-11-17T13:00:00.000Z' });
    x.relogio.agora = sp('2026-11-17T15:00:00');
    expect(await (await x.chamar('/t1', 'PATCH', { concluida: true })).json()).toMatchObject({ concluida: true, concluida_em: '2026-11-17T13:00:00.000Z' });
    const desfeita = await x.chamar('/t1', 'PATCH', { concluida: false });
    expect(await desfeita.json()).toMatchObject({ concluida: false, concluida_em: null });
    expect(await x.t.env.DB.prepare("SELECT concluida, concluida_em FROM tarefas WHERE id='t1'").first()).toEqual({ concluida: 0, concluida_em: null });
    // concluir outra vez grava o novo instante
    expect(await (await x.chamar('/t1', 'PATCH', { concluida: true })).json()).toMatchObject({ concluida_em: '2026-11-17T18:00:00.000Z' });
  });

  it('a concluída sai da frente da lista e volta ao lugar certo ao desfazer', async () => {
    const x = await preparar();
    await x.inserir('a', '2026-11-10', '2026-11-01T00:00:00Z');
    await x.inserir('b', null, '2026-11-02T00:00:00Z');
    await x.chamar('/a', 'PATCH', { concluida: true });
    expect(await x.ids()).toEqual(['b', 'a']);
    await x.chamar('/a', 'PATCH', { concluida: false });
    expect(await x.ids()).toEqual(['a', 'b']);
  });

  it('edita título, área e prazo (null remove o prazo) sem mexer no resto', async () => {
    const x = await preparar();
    await x.inserir('t1', '2026-11-20', '2026-11-01T00:00:00Z');
    expect(await (await x.chamar('/t1', 'PATCH', { titulo: '  Novo título  ' })).json()).toMatchObject({ titulo: 'Novo título', area: 'trabalho', prazo: '2026-11-20', concluida: false });
    expect(await (await x.chamar('/t1', 'PATCH', { area: 'saude', prazo: '2026-12-01' })).json()).toMatchObject({ titulo: 'Novo título', area: 'saude', prazo: '2026-12-01' });
    expect(await (await x.chamar('/t1', 'PATCH', { prazo: null })).json()).toMatchObject({ prazo: null, area: 'saude' });
  });

  it('não permite trocar dono, origem nem criada_em pelo corpo', async () => {
    const x = await preparar();
    await x.inserir('t1', null, '2026-11-01T00:00:00Z');
    const r = await x.chamar('/t1', 'PATCH', { titulo: 'Y', usuario_id: 'outro', origem: 'chat', criada_em: '2000-01-01T00:00:00Z', concluida_em: '2000-01-01T00:00:00Z' });
    expect(await r.json()).toMatchObject({ titulo: 'Y', origem: 'manual', criada_em: '2026-11-01T00:00:00Z', concluida_em: null });
    expect((await x.t.env.DB.prepare("SELECT usuario_id FROM tarefas WHERE id='t1'").first<{ usuario_id: string }>())!.usuario_id).toBe(x.dono);
  });

  it('valida: corpo vazio, título vazio ou > 120, área ou prazo inválidos, concluida não booleano → 400 e a tarefa não muda', async () => {
    const x = await preparar();
    await x.inserir('t1', '2026-11-20', '2026-11-01T00:00:00Z');
    for (const corpo of [{}, { titulo: '' }, { titulo: 'x'.repeat(121) }, { area: 'sobre_mim' }, { prazo: 'amanhã' }, { prazo: '2026-13-01' }, { concluida: 'sim' }, { concluida: 1 }, 'texto', [1], null]) {
      expect((await x.chamar('/t1', 'PATCH', corpo)).status, JSON.stringify(corpo)).toBe(400);
    }
    expect(await x.t.env.DB.prepare("SELECT titulo, area, prazo, concluida FROM tarefas WHERE id='t1'").first()).toEqual({ titulo: 'Tarefa t1', area: 'trabalho', prazo: '2026-11-20', concluida: 0 });
  });
});

describe('DELETE /api/tarefas/:id', () => {
  it('apaga (204) e some da lista; apagar de novo → 404', async () => {
    const x = await preparar();
    await x.inserir('t1', null, '2026-11-01T00:00:00Z');
    await x.inserir('t2', null, '2026-11-02T00:00:00Z');
    expect((await x.chamar('/t1', 'DELETE')).status).toBe(204);
    expect(await x.ids()).toEqual(['t2']);
    expect((await x.chamar('/t1', 'DELETE')).status).toBe(404);
  });

  it('apagar a tarefa não mexe na sugestão que a originou (o cartão continua "salvo")', async () => {
    const x = await preparar();
    await x.inserir('t1', null, '2026-11-01T00:00:00Z');
    await x.t.env.DB.prepare("INSERT INTO conversas(id,usuario_id,tipo,modo,criada_em,atualizada_em) VALUES('c1',?,'normal','padrao','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z')").bind(x.dono).run();
    await x.t.env.DB.prepare("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES('m1','c1','jose','x','texto','2026-11-01T00:00:00Z')").run();
    await x.t.env.DB.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,status,item_id,criada_em) VALUES('s1','m1','tarefa','{}','salva','t1','2026-11-01T00:00:00Z')").run();
    expect((await x.chamar('/t1', 'DELETE')).status).toBe(204);
    expect(await x.t.env.DB.prepare("SELECT status, item_id FROM sugestoes WHERE id='s1'").first()).toEqual({ status: 'salva', item_id: 't1' });
  });
});

describe('posse e acesso', () => {
  it('tarefa de outro usuário ou inexistente: PATCH e DELETE → 404 igual, e nada muda', async () => {
    const x = await preparar();
    await x.t.env.DB.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('outro','outro@x.com','Outro','2026-01-01T00:00:00Z')").run();
    await x.inserir('alheia', '2026-11-20', '2026-11-01T00:00:00Z', { dono: 'outro' });
    for (const id of ['alheia', 'nao-existe']) {
      for (const [metodo, corpo] of [['PATCH', { concluida: true }], ['PATCH', { titulo: 'Invadida' }], ['DELETE', undefined]] as const) {
        const r = await x.chamar(`/${id}`, metodo, corpo);
        expect(r.status, `${metodo} ${id}`).toBe(404);
        expect(((await r.json()) as { erro: { codigo: string } }).erro.codigo).toBe('nao_encontrado');
      }
    }
    expect(await x.t.env.DB.prepare("SELECT titulo, concluida FROM tarefas WHERE id='alheia'").first()).toEqual({ titulo: 'Tarefa alheia', concluida: 0 });
  });

  it('exige sessão (401) e Origin correto nas escritas (403)', async () => {
    const x = await preparar();
    await x.inserir('t1', null, '2026-11-01T00:00:00Z');
    expect((await x.t.chamar('/api/tarefas', { headers: { origin: URL_TESTE } })).status).toBe(401);
    expect((await x.t.chamar('/api/tarefas/t1', { method: 'PATCH', headers: { origin: URL_TESTE, 'content-type': 'application/json' }, body: '{"concluida":true}' })).status).toBe(401);
    expect((await x.t.chamar('/api/tarefas', { method: 'POST', headers: { cookie: x.cookie, origin: 'https://outro.site', 'content-type': 'application/json' }, body: '{"titulo":"x","area":"casa"}' })).status).toBe(403);
    expect((await x.t.chamar('/api/tarefas/t1', { method: 'DELETE', headers: { cookie: x.cookie, origin: 'https://outro.site' } })).status).toBe(403);
    expect((await x.t.env.DB.prepare('SELECT COUNT(*) AS n FROM tarefas').first<{ n: number }>())!.n).toBe(1);
  });
});
