import { describe, expect, it } from 'vitest';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';

const sp = (iso: string) => new Date(`${iso}-03:00`);

async function preparar() {
  const relogio = { agora: sp('2026-11-17T10:00:00') };
  const t = criarAppTeste({ agora: () => relogio.agora });
  const { cookie } = await entrar(t);
  const dono = (await t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
  const chamar = (caminho: string, metodo = 'GET', corpo?: unknown) =>
    t.chamar(`/api/metas${caminho}`, {
      method: metodo,
      headers: { cookie, origin: URL_TESTE, ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  const inserir = (id: string, criada: string, extra: { status?: 'ativa' | 'concluida'; concluida_em?: string; prazo?: string; dono?: string } = {}) =>
    t.env.DB.prepare("INSERT INTO metas (id, usuario_id, titulo, area, prazo, status, concluida_em, origem, criada_em) VALUES (?, ?, ?, 'saude', ?, ?, ?, 'manual', ?)")
      .bind(id, extra.dono ?? dono, `Meta ${id}`, extra.prazo ?? null, extra.status ?? 'ativa', extra.concluida_em ?? null, criada).run();
  const ids = async () => ((await (await chamar('')).json()) as Array<{ id: string }>).map((x) => x.id);
  return { t, relogio, cookie, dono, chamar, inserir, ids };
}

describe('/api/metas', () => {
  it('GET: as ativas (a mais nova primeiro) e depois as concluídas (a mais recente primeiro), só as do usuário, sem usuario_id', async () => {
    const x = await preparar();
    await x.t.env.DB.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('outro','outro@x.com','Outro','2026-01-01T00:00:00Z')").run();
    await x.inserir('velha', '2026-11-01T00:00:00Z');
    await x.inserir('nova', '2026-11-05T00:00:00Z');
    await x.inserir('feita-antes', '2026-11-01T00:00:00Z', { status: 'concluida', concluida_em: '2026-11-10T00:00:00Z' });
    await x.inserir('feita-agora', '2026-11-01T00:00:00Z', { status: 'concluida', concluida_em: '2026-11-16T00:00:00Z' });
    await x.inserir('alheia', '2026-11-09T00:00:00Z', { dono: 'outro' });
    expect(await x.ids()).toEqual(['nova', 'velha', 'feita-agora', 'feita-antes']);
    const corpo = (await (await x.chamar('')).json()) as Array<Record<string, unknown>>;
    expect(corpo[0]).toEqual({ id: 'nova', titulo: 'Meta nova', area: 'saude', prazo: null, status: 'ativa', concluida_em: null, origem: 'manual', criada_em: '2026-11-05T00:00:00Z' });
  });

  it('POST cria ativa com origem manual (201), título aparado e prazo opcional; ignora usuario_id/status/origem do corpo', async () => {
    const x = await preparar();
    const r = await x.chamar('', 'POST', { titulo: '  Correr uma meia-maratona  ', area: 'saude', prazo: '2027-11-14', usuario_id: 'outro', status: 'concluida', origem: 'chat' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ id: expect.any(String), titulo: 'Correr uma meia-maratona', area: 'saude', prazo: '2027-11-14', status: 'ativa', concluida_em: null, origem: 'manual', criada_em: '2026-11-17T13:00:00.000Z' });
    expect((await x.t.env.DB.prepare('SELECT usuario_id FROM metas').first<{ usuario_id: string }>())!.usuario_id).toBe(x.dono);
    expect(await (await x.chamar('', 'POST', { titulo: 'Sem prazo', area: 'casa' })).json()).toMatchObject({ prazo: null });
  });

  it('POST valida título (vazio, > 120), área, prazo e corpo inválido → 400 e nada é criado', async () => {
    const x = await preparar();
    for (const corpo of [{ titulo: ' ', area: 'casa' }, { titulo: 'x'.repeat(121), area: 'casa' }, { titulo: 'ok', area: 'nada' }, { titulo: 'ok' }, { titulo: 'ok', area: 'casa', prazo: '2026-99-99' }, 'texto', null]) {
      expect((await x.chamar('', 'POST', corpo)).status, JSON.stringify(corpo)).toBe(400);
    }
    expect((await x.t.env.DB.prepare('SELECT COUNT(*) AS n FROM metas').first<{ n: number }>())!.n).toBe(0);
    expect((await x.chamar('', 'POST', { titulo: 'x'.repeat(120), area: 'casa' })).status).toBe(201);
  });

  it('PATCH conclui (grava concluida_em), mantém o instante se concluir de novo e reativa (limpa)', async () => {
    const x = await preparar();
    await x.inserir('m1', '2026-11-01T00:00:00Z');
    expect(await (await x.chamar('/m1', 'PATCH', { status: 'concluida' })).json()).toMatchObject({ status: 'concluida', concluida_em: '2026-11-17T13:00:00.000Z' });
    x.relogio.agora = sp('2026-11-17T15:00:00');
    expect(await (await x.chamar('/m1', 'PATCH', { status: 'concluida' })).json()).toMatchObject({ concluida_em: '2026-11-17T13:00:00.000Z' });
    expect(await (await x.chamar('/m1', 'PATCH', { status: 'ativa' })).json()).toMatchObject({ status: 'ativa', concluida_em: null });
    expect(await x.ids()).toEqual(['m1']);
  });

  it('PATCH edita título, área e prazo (null remove) sem mexer no resto', async () => {
    const x = await preparar();
    await x.inserir('m1', '2026-11-01T00:00:00Z', { prazo: '2027-01-01' });
    expect(await (await x.chamar('/m1', 'PATCH', { titulo: '  Novo  ', area: 'financas' })).json()).toMatchObject({ titulo: 'Novo', area: 'financas', prazo: '2027-01-01', status: 'ativa' });
    expect(await (await x.chamar('/m1', 'PATCH', { prazo: null })).json()).toMatchObject({ prazo: null, titulo: 'Novo' });
    const r = await x.chamar('/m1', 'PATCH', { titulo: 'Y', usuario_id: 'outro', origem: 'chat', concluida_em: '2000-01-01T00:00:00Z' });
    expect(await r.json()).toMatchObject({ titulo: 'Y', origem: 'manual', concluida_em: null });
  });

  it('PATCH valida: corpo vazio, título vazio ou > 120, área, prazo e status inválidos (inclui `pausada`, que é da V1.1) → 400', async () => {
    const x = await preparar();
    await x.inserir('m1', '2026-11-01T00:00:00Z');
    for (const corpo of [{}, { titulo: '' }, { titulo: 'x'.repeat(121) }, { area: 'sobre_mim' }, { prazo: 'amanhã' }, { status: 'pausada' }, { status: 'feita' }, { status: true }, 'texto', [1], null]) {
      expect((await x.chamar('/m1', 'PATCH', corpo)).status, JSON.stringify(corpo)).toBe(400);
    }
    expect(await x.t.env.DB.prepare("SELECT titulo, status FROM metas WHERE id='m1'").first()).toEqual({ titulo: 'Meta m1', status: 'ativa' });
  });

  it('DELETE apaga (204); de novo → 404', async () => {
    const x = await preparar();
    await x.inserir('m1', '2026-11-01T00:00:00Z');
    expect((await x.chamar('/m1', 'DELETE')).status).toBe(204);
    expect(await x.ids()).toEqual([]);
    expect((await x.chamar('/m1', 'DELETE')).status).toBe(404);
  });

  it('posse: meta de outro usuário ou inexistente → 404 igual em PATCH e DELETE, e nada muda', async () => {
    const x = await preparar();
    await x.t.env.DB.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('outro','outro@x.com','Outro','2026-01-01T00:00:00Z')").run();
    await x.inserir('alheia', '2026-11-01T00:00:00Z', { dono: 'outro' });
    for (const id of ['alheia', 'nao-existe']) {
      for (const [metodo, corpo] of [['PATCH', { status: 'concluida' }], ['PATCH', { titulo: 'Invadida' }], ['DELETE', undefined]] as const) {
        expect((await x.chamar(`/${id}`, metodo, corpo)).status, `${metodo} ${id}`).toBe(404);
      }
    }
    expect(await x.t.env.DB.prepare("SELECT titulo, status FROM metas WHERE id='alheia'").first()).toEqual({ titulo: 'Meta alheia', status: 'ativa' });
  });

  it('exige sessão (401) e Origin correto nas escritas (403)', async () => {
    const x = await preparar();
    expect((await x.t.chamar('/api/metas', { headers: { origin: URL_TESTE } })).status).toBe(401);
    expect((await x.t.chamar('/api/metas', { method: 'POST', headers: { cookie: x.cookie, origin: 'https://outro.site', 'content-type': 'application/json' }, body: '{"titulo":"x","area":"casa"}' })).status).toBe(403);
  });

  it('apagar a meta não mexe nas tarefas', async () => {
    const x = await preparar();
    await x.inserir('m1', '2026-11-01T00:00:00Z');
    await x.t.env.DB.prepare("INSERT INTO tarefas (id, usuario_id, titulo, area, origem, criada_em) VALUES ('t1', ?, 'T', 'casa', 'manual', '2026-11-01T00:00:00Z')").bind(x.dono).run();
    await x.chamar('/m1', 'DELETE');
    expect((await x.t.env.DB.prepare('SELECT COUNT(*) AS n FROM tarefas').first<{ n: number }>())!.n).toBe(1);
  });
});
