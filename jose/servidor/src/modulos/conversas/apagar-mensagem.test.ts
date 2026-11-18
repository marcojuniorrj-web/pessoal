import { describe, expect, it } from 'vitest';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';

type T = ReturnType<typeof criarAppTeste>;

const apagar = (t: T, cookie: string, caminho: string) => t.chamar(caminho, { method: 'DELETE', headers: { cookie, origin: URL_TESTE } });
const n = async (t: T, sql: string) => (await t.env.DB.prepare(sql).first<{ n: number }>())!.n;
const ids = async (t: T) => (await t.env.DB.prepare('SELECT id FROM mensagens ORDER BY conversa_id, criada_em, rowid').all<{ id: string }>()).results.map((m) => m.id);

/** Conversa c1: m1 (Marco), m2 (José, com 2 sugestões: uma salva e uma pendente), m3 (Marco), m4 (José). Mais uma conversa alheia. */
async function cenario() {
  const t = criarAppTeste();
  const { cookie } = await entrar(t);
  const u = (await t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
  const db = t.env.DB;
  await db.prepare("INSERT INTO conversas(id,usuario_id,tipo,criada_em,atualizada_em) VALUES('c1',?,'normal','2026-11-17T12:00:00Z','2026-11-17T12:00:00Z')").bind(u).run();
  const msg = (id: string, autor: string, min: number) =>
    db.prepare("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES(?,'c1',?,?,'texto',?)").bind(id, autor, id, `2026-11-17T12:0${min}:00Z`).run();
  await msg('m1', 'marco', 1);
  await msg('m2', 'jose', 2);
  await msg('m3', 'marco', 3);
  await msg('m4', 'jose', 4);
  await db.prepare("INSERT INTO tarefas(id,usuario_id,titulo,area,origem,criada_em) VALUES('t1',?,'Salva','casa','chat','2026-11-17T12:00:00Z')").bind(u).run();
  await db.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,status,item_id,criada_em) VALUES('s1','m2','tarefa','{}','salva','t1','2026-11-17T12:02:00Z')").run();
  await db.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,status,criada_em) VALUES('s2','m2','meta','{}','pendente','2026-11-17T12:02:00Z')").run();
  await db.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('outro','outro@x.com','Outro','2026-01-01T00:00:00Z')").run();
  await db.prepare("INSERT INTO conversas(id,usuario_id,tipo,criada_em,atualizada_em) VALUES('ca','outro','normal','2026-11-17T12:00:00Z','2026-11-17T12:00:00Z')").run();
  await db.prepare("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES('ma','ca','marco','segredo','texto','2026-11-17T12:00:00Z')").run();
  return { t, cookie };
}

describe('DELETE /api/mensagens/:id', () => {
  it('sem sessão → 401', async () => {
    const { t } = await cenario();
    expect((await t.chamar('/api/mensagens/m1', { method: 'DELETE', headers: { origin: URL_TESTE } })).status).toBe(401);
  });

  it('apaga só a mensagem pedida (204)', async () => {
    const { t, cookie } = await cenario();
    expect((await apagar(t, cookie, '/api/mensagens/m3')).status).toBe(204);
    expect(await ids(t)).toEqual(['m1', 'm2', 'm4', 'ma']);
  });

  it('mensagem de outro usuário ou inexistente → 404 igual, e nada é apagado', async () => {
    const { t, cookie } = await cenario();
    const alheia = await apagar(t, cookie, '/api/mensagens/ma');
    const nada = await apagar(t, cookie, '/api/mensagens/nao-existe');
    expect(alheia.status).toBe(404);
    expect(await alheia.json()).toEqual(await nada.json());
    expect(await n(t, "SELECT COUNT(*) AS n FROM mensagens WHERE id='ma'")).toBe(1);
    expect((await apagar(t, cookie, '/api/mensagens/ma?com_resposta=1')).status).toBe(404);
  });

  it('com_resposta=1 apaga também a resposta do José logo depois', async () => {
    const { t, cookie } = await cenario();
    expect((await apagar(t, cookie, '/api/mensagens/m1?com_resposta=1')).status).toBe(204);
    expect(await ids(t)).toEqual(['m3', 'm4', 'ma']);
  });

  it('com_resposta=1 sem resposta seguinte apaga só a mensagem; se a seguinte for do Marco, não a leva', async () => {
    const { t, cookie } = await cenario();
    await t.env.DB.prepare("DELETE FROM mensagens WHERE id = 'm4'").run();
    expect((await apagar(t, cookie, '/api/mensagens/m3?com_resposta=1')).status).toBe(204);
    expect(await ids(t)).toEqual(['m1', 'm2', 'ma']);
    await t.env.DB.prepare("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES('m5','c1','marco','m5','texto','2026-11-17T12:05:00Z')").run();
    expect((await apagar(t, cookie, '/api/mensagens/m2')).status).toBe(204);
    expect((await apagar(t, cookie, '/api/mensagens/m1?com_resposta=1')).status).toBe(204);
    expect(await ids(t)).toEqual(['m5', 'ma']);
  });

  it('com_resposta só vale para mensagem do Marco (400) e só aceita 1', async () => {
    const { t, cookie } = await cenario();
    const r = await apagar(t, cookie, '/api/mensagens/m2?com_resposta=1');
    expect(r.status).toBe(400);
    expect(((await r.json()) as { erro: { codigo: string } }).erro.codigo).toBeTruthy();
    expect((await apagar(t, cookie, '/api/mensagens/m1?com_resposta=sim')).status).toBe(400);
    expect(await ids(t)).toEqual(['m1', 'm2', 'm3', 'm4', 'ma']);
  });

  it('cascata nas sugestões da mensagem; itens salvos permanecem', async () => {
    const { t, cookie } = await cenario();
    expect((await apagar(t, cookie, '/api/mensagens/m2')).status).toBe(204);
    expect(await n(t, 'SELECT COUNT(*) AS n FROM sugestoes')).toBe(0);
    expect(await n(t, 'SELECT COUNT(*) AS n FROM tarefas')).toBe(1);
  });

  it('apagar de novo → 404 (o app trata como já apagada); a conversa e o limite diário não mudam', async () => {
    const { t, cookie } = await cenario();
    await t.env.DB.prepare("INSERT INTO uso_diario(usuario_id,dia,respostas) SELECT id,'2026-11-17',3 FROM usuarios WHERE id <> 'outro'").run();
    expect((await apagar(t, cookie, '/api/mensagens/m4')).status).toBe(204);
    expect((await apagar(t, cookie, '/api/mensagens/m4')).status).toBe(404);
    expect(await n(t, "SELECT COUNT(*) AS n FROM conversas WHERE id='c1'")).toBe(1);
    expect(await n(t, 'SELECT respostas AS n FROM uso_diario')).toBe(3);
  });

  it('a mensagem apagada deixa de ir para o contexto da IA', async () => {
    const { t, cookie } = await cenario();
    await apagar(t, cookie, '/api/mensagens/m1?com_resposta=1');
    const resp = await t.chamar('/api/conversas/c1', { headers: { cookie } });
    const j = (await resp.json()) as { mensagens: { id: string }[]; sugestoes: unknown[] };
    expect(j.mensagens.map((m) => m.id)).toEqual(['m3', 'm4']);
    expect(j.sugestoes).toEqual([]);
  });
});
