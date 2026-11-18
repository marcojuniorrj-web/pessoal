import { describe, expect, it } from 'vitest';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';

type T = ReturnType<typeof criarAppTeste>;
const chamar = (t: T, cookie: string, caminho: string, metodo = 'GET', corpo?: unknown) =>
  t.chamar(caminho, {
    method: metodo,
    headers: { cookie, origin: URL_TESTE, ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

let relogio = new Date('2026-11-18T10:00:00Z');
async function preparar() {
  relogio = new Date('2026-11-18T10:00:00Z');
  const t = criarAppTeste({ agora: () => relogio });
  const { cookie } = await entrar(t);
  const dono = (await t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
  return { t, cookie, dono };
}
const lista = async (t: T, cookie: string) => (await (await chamar(t, cookie, '/api/memorias')).json()) as Array<{ id: string; texto: string; area: string; origem: string; atualizada_em: string | null }>;

describe('/api/memorias (4.3)', () => {
  it('exige sessão (401) e checa o Origin nas escritas (403)', async () => {
    const t = criarAppTeste();
    expect((await t.chamar('/api/memorias')).status).toBe(401);
    const { cookie } = await entrar(t);
    const r = await t.chamar('/api/memorias', { method: 'POST', headers: { cookie, origin: 'https://outro.site', 'content-type': 'application/json' }, body: '{"texto":"x","area":"casa"}' });
    expect(r.status).toBe(403);
  });

  it('cria (origem manual), lista com as mais novas primeiro e não vaza o usuario_id', async () => {
    const { t, cookie } = await preparar();
    const a = await chamar(t, cookie, '/api/memorias', 'POST', { texto: '  Acorda às 6h.  ', area: 'saude' });
    expect(a.status).toBe(201);
    const criada = (await a.json()) as Record<string, unknown>;
    expect(criada).toMatchObject({ texto: 'Acorda às 6h.', area: 'saude', origem: 'manual', criada_em: '2026-11-18T10:00:00.000Z', atualizada_em: null });
    expect(criada).not.toHaveProperty('usuario_id');
    relogio = new Date('2026-11-18T11:00:00Z');
    await chamar(t, cookie, '/api/memorias', 'POST', { texto: 'Gerente comercial.', area: 'sobre_mim' });
    expect((await lista(t, cookie)).map((m) => m.texto)).toEqual(['Gerente comercial.', 'Acorda às 6h.']);
  });

  it('valida o texto (1 a 300 caracteres, sem só espaços) e a área', async () => {
    const { t, cookie } = await preparar();
    const ruins: unknown[] = [
      { texto: 'x'.repeat(301), area: 'casa' },
      { texto: '', area: 'casa' },
      { texto: '    ', area: 'casa' },
      { texto: 'ok', area: 'esportes' },
      { texto: 'ok' },
      { area: 'casa' },
      { texto: 42, area: 'casa' },
      null,
      [],
    ];
    for (const corpo of ruins) {
      const r = await chamar(t, cookie, '/api/memorias', 'POST', corpo);
      expect(r.status, JSON.stringify(corpo)).toBe(400);
      expect(((await r.json()) as { erro: { codigo: string } }).erro.codigo).toBe('requisicao_invalida');
    }
    expect((await chamar(t, cookie, '/api/memorias', 'POST', { texto: 'x'.repeat(300), area: 'casa' })).status).toBe(201); // 300 é o limite
    expect((await chamar(t, cookie, '/api/memorias', 'POST', { texto: 'sobre mim', area: 'sobre_mim' })).status).toBe(201);
    expect(await lista(t, cookie)).toHaveLength(2);
  });

  it('edita texto e/ou área (PATCH) e grava atualizada_em; corpo vazio ou inválido → 400', async () => {
    const { t, cookie } = await preparar();
    const { id } = (await (await chamar(t, cookie, '/api/memorias', 'POST', { texto: 'Acorda às 6h.', area: 'saude' })).json()) as { id: string };
    relogio = new Date('2026-11-19T08:00:00Z');
    const a = await chamar(t, cookie, `/api/memorias/${id}`, 'PATCH', { texto: 'Acorda às 5h30.' });
    expect(a.status).toBe(200);
    expect(await a.json()).toMatchObject({ id, texto: 'Acorda às 5h30.', area: 'saude', criada_em: '2026-11-18T10:00:00.000Z', atualizada_em: '2026-11-19T08:00:00.000Z' });
    expect(await (await chamar(t, cookie, `/api/memorias/${id}`, 'PATCH', { area: 'casa' })).json()).toMatchObject({ texto: 'Acorda às 5h30.', area: 'casa' });
    for (const corpo of [{}, { texto: '' }, { texto: 'x'.repeat(301) }, { area: 'nada' }, null]) {
      expect((await chamar(t, cookie, `/api/memorias/${id}`, 'PATCH', corpo)).status, JSON.stringify(corpo)).toBe(400);
    }
    expect((await lista(t, cookie))[0]).toMatchObject({ texto: 'Acorda às 5h30.', area: 'casa' }); // nada foi alterado pelos pedidos inválidos
  });

  it('apaga (204) e a memória some; apagar de novo → 404', async () => {
    const { t, cookie } = await preparar();
    const { id } = (await (await chamar(t, cookie, '/api/memorias', 'POST', { texto: 'Tem um filho.', area: 'casa' })).json()) as { id: string };
    expect((await chamar(t, cookie, `/api/memorias/${id}`, 'DELETE')).status).toBe(204);
    expect(await lista(t, cookie)).toEqual([]);
    expect((await chamar(t, cookie, `/api/memorias/${id}`, 'DELETE')).status).toBe(404);
  });

  it('posse: memória de outro usuário não aparece e dá 404 (igual a inexistente) em editar e apagar', async () => {
    const { t, cookie } = await preparar();
    await t.env.DB.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('outro','outro@x.com','Outro','2026-01-01T00:00:00Z')").run();
    await t.env.DB.prepare("INSERT INTO memorias(id,usuario_id,texto,area,origem,criada_em) VALUES('alheia','outro','Segredo do outro.','casa','manual','2026-11-01T00:00:00Z')").run();
    expect(await lista(t, cookie)).toEqual([]);
    for (const id of ['alheia', 'nao-existe']) {
      const e = await chamar(t, cookie, `/api/memorias/${id}`, 'PATCH', { texto: 'invadido' });
      const d = await chamar(t, cookie, `/api/memorias/${id}`, 'DELETE');
      expect([e.status, d.status]).toEqual([404, 404]);
      expect(((await d.json()) as { erro: { codigo: string } }).erro.codigo).toBe('nao_encontrado');
    }
    expect(await t.env.DB.prepare("SELECT texto FROM memorias WHERE id='alheia'").first()).toEqual({ texto: 'Segredo do outro.' });
  });
});
