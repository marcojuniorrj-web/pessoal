import { describe, expect, it, vi } from 'vitest';
import { dependenciasPadrao } from '../../compartilhado/dependencias';
import { ErroIA } from '../../adaptadores/ia/tipos';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';
import { criarIaFalsa, lerEventos, type Passo } from '../../../testes/ia-falsa';

type T = ReturnType<typeof criarAppTeste>;
const sp = (iso: string) => new Date(`${iso}-03:00`);
const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function preparar(roteiro: Passo[] | Parameters<typeof criarIaFalsa>[0] = [{}], extra: Parameters<typeof criarAppTeste>[0] = {}, titulo?: string | Error) {
  const falsa = criarIaFalsa(roteiro, { titulo });
  const t = criarAppTeste({ ia: falsa.ia, agora: () => sp('2026-11-17T10:00:00'), ...extra });
  const { cookie } = await entrar(t);
  const { id } = (await (await t.chamar('/api/conversas', { method: 'POST', headers: { cookie, origin: URL_TESTE, 'content-type': 'application/json' }, body: '{"tipo":"normal"}' })).json()) as { id: string };
  const enviar = (msg: { id: string; texto: string; origem?: string }, conversa = id) =>
    t.chamar(`/api/conversas/${conversa}/mensagens`, { method: 'POST', headers: { cookie, origin: URL_TESTE, 'content-type': 'application/json' }, body: JSON.stringify({ origem: 'texto', ...msg }) });
  const contar = async (sql: string) => (await t.env.DB.prepare(sql).first<{ n: number }>())!.n;
  return { t, cookie, id, enviar, contar, ...falsa };
}

describe('POST /api/conversas/:id/mensagens (SSE)', () => {
  it('transmite o texto em partes, grava a mensagem do Marco e a resposta com modelo e tokens', async () => {
    const x = await preparar([{ partes: ['Bom ', 'dia, ', 'Marco.'], uso: { tokensEntrada: 321, tokensSaida: 12, tokensCache: 250 } }]);
    const r = await x.enviar({ id: UUID(1), texto: 'O que faço hoje?' });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/event-stream');
    const eventos = await lerEventos(r);
    expect(eventos.map((e) => e.evento)).toEqual(['texto', 'texto', 'texto', 'fim']);
    expect(eventos.slice(0, 3).map((e) => e.dados.delta)).toEqual(['Bom ', 'dia, ', 'Marco.']);

    const linhas = (await x.t.env.DB.prepare('SELECT id, autor, texto, origem, modelo, tokens_entrada, tokens_saida, tokens_cache FROM mensagens ORDER BY rowid').all()).results;
    expect(linhas).toEqual([
      { id: UUID(1), autor: 'marco', texto: 'O que faço hoje?', origem: 'texto', modelo: null, tokens_entrada: null, tokens_saida: null, tokens_cache: null },
      { id: eventos[3]!.dados.mensagem_id, autor: 'jose', texto: 'Bom dia, Marco.', origem: 'texto', modelo: 'claude-haiku-5-5', tokens_entrada: 321, tokens_saida: 12, tokens_cache: 250 },
    ]);
  });

  it('a mensagem do Marco é gravada antes de chamar a IA (e sobrevive se a IA falhar)', async () => {
    let gravadasQuandoIaFoiChamada = -1;
    const ref: { t?: T } = {};
    const ia = {
      // eslint-disable-next-line require-yield
      async *transmitir(): AsyncGenerator<never> {
        gravadasQuandoIaFoiChamada = (await ref.t!.env.DB.prepare("SELECT COUNT(*) AS n FROM mensagens WHERE autor='marco'").first<{ n: number }>())!.n;
        throw new ErroIA('indisponivel', 'x');
      },
    };
    const t = criarAppTeste({ ia, agora: () => sp('2026-11-17T10:00:00') });
    ref.t = t;
    const { cookie } = await entrar(t);
    const cab = { cookie, origin: URL_TESTE, 'content-type': 'application/json' };
    const { id } = (await (await t.chamar('/api/conversas', { method: 'POST', headers: cab, body: '{"tipo":"normal"}' })).json()) as { id: string };
    const eventos = await lerEventos(await t.chamar(`/api/conversas/${id}/mensagens`, { method: 'POST', headers: cab, body: JSON.stringify({ id: UUID(2), texto: 'oi', origem: 'texto' }) }));
    expect(eventos).toEqual([{ evento: 'erro', dados: { codigo: 'ia_indisponivel', mensagem: 'O José não conseguiu responder agora.' } }]);
    expect(gravadasQuandoIaFoiChamada).toBe(1);
    const n = (await t.env.DB.prepare('SELECT COUNT(*) AS n FROM mensagens').first<{ n: number }>())!.n;
    expect(n).toBe(1); // só a do Marco; nenhuma resposta incompleta
  });

  it('retry com o mesmo id não duplica a mensagem do Marco e gera só a resposta que faltou', async () => {
    const x = await preparar([{ partes: ['parcial'], erro: new ErroIA('rede', 'caiu') }, { partes: ['Resposta ', 'completa.'] }]);
    const primeira = await lerEventos(await x.enviar({ id: UUID(3), texto: 'travei no relatório' }));
    expect(primeira.map((e) => e.evento)).toEqual(['texto', 'erro']);
    expect(await x.contar("SELECT COUNT(*) AS n FROM mensagens WHERE autor='marco'")).toBe(1);
    expect(await x.contar("SELECT COUNT(*) AS n FROM mensagens WHERE autor='jose'")).toBe(0);

    const retry = await lerEventos(await x.enviar({ id: UUID(3), texto: 'travei no relatório' }));
    expect(retry.map((e) => e.evento)).toEqual(['texto', 'texto', 'fim']);
    expect(await x.contar("SELECT COUNT(*) AS n FROM mensagens WHERE autor='marco'")).toBe(1);
    expect(await x.contar("SELECT COUNT(*) AS n FROM mensagens WHERE autor='jose'")).toBe(1);
    // o contexto da segunda chamada tem uma única mensagem do Marco (sem duplicata)
    expect(x.pedidos[1]!.mensagens).toEqual([{ papel: 'user', texto: 'travei no relatório' }]);
  });

  it('retry depois de a resposta já existir devolve a resposta gravada, sem chamar a IA de novo', async () => {
    const x = await preparar([{ partes: ['Única resposta.'] }]);
    const a = await lerEventos(await x.enviar({ id: UUID(4), texto: 'oi' }));
    const b = await lerEventos(await x.enviar({ id: UUID(4), texto: 'oi' }));
    expect(x.pedidos).toHaveLength(1);
    expect(b.map((e) => e.evento)).toEqual(['texto', 'fim']);
    expect(b[0]!.dados.delta).toBe('Única resposta.');
    expect(b[1]!.dados.mensagem_id).toBe(a.at(-1)!.dados.mensagem_id);
    expect(await x.contar('SELECT COUNT(*) AS n FROM mensagens')).toBe(2);
  });

  it('id já usado em outra conversa → 409; id de resposta do José → 409', async () => {
    const x = await preparar();
    await x.enviar({ id: UUID(5), texto: 'a' });
    const outra = (await (await x.t.chamar('/api/conversas', { method: 'POST', headers: { cookie: x.cookie, origin: URL_TESTE, 'content-type': 'application/json' }, body: '{"tipo":"normal"}' })).json()) as { id: string };
    expect((await x.enviar({ id: UUID(5), texto: 'a' }, outra.id)).status).toBe(409);
    const jose = (await x.t.env.DB.prepare("SELECT id FROM mensagens WHERE autor='jose'").first<{ id: string }>())!.id;
    expect((await x.enviar({ id: jose, texto: 'a' })).status).toBe(409);
  });

  it('limite diário: 429 e nada é gravado; "Tentar de novo" também conta; outro dia zera', async () => {
    const x = await preparar([{}], { env: { LIMITE_MENSAGENS_DIA: '2' } });
    expect((await x.enviar({ id: UUID(6), texto: '1' })).status).toBe(200);
    expect((await x.enviar({ id: UUID(7), texto: '2' })).status).toBe(200);
    const r = await x.enviar({ id: UUID(8), texto: '3' });
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ erro: { codigo: 'limite_diario', mensagem: 'Limite de hoje atingido, volta amanhã.' } });
    expect(await x.contar("SELECT COUNT(*) AS n FROM mensagens WHERE autor='marco'")).toBe(2);
    expect(x.pedidos).toHaveLength(2);
  });

  it('o limite é do dia local: respostas de ontem (fuso do Marco) não contam', async () => {
    let agora = sp('2026-11-17T23:50:00');
    const x = await preparar([{}], { env: { LIMITE_MENSAGENS_DIA: '1' }, agora: () => agora });
    expect((await x.enviar({ id: UUID(9), texto: 'a' })).status).toBe(200);
    expect((await x.enviar({ id: UUID(10), texto: 'b' })).status).toBe(429);
    agora = sp('2026-11-18T00:10:00'); // virou o dia em São Paulo (ainda é 03h10 UTC do mesmo dia seguinte)
    expect((await x.enviar({ id: UUID(11), texto: 'c' })).status).toBe(200);
  });

  it('atualiza atualizada_em da conversa', async () => {
    let agora = sp('2026-11-17T09:00:00');
    const x = await preparar([{}], { agora: () => agora });
    const antes = (await x.t.env.DB.prepare('SELECT atualizada_em FROM conversas').first<{ atualizada_em: string }>())!.atualizada_em;
    agora = sp('2026-11-17T09:30:00');
    await (await x.enviar({ id: UUID(12), texto: 'oi' })).text();
    const depois = (await x.t.env.DB.prepare('SELECT atualizada_em FROM conversas').first<{ atualizada_em: string }>())!.atualizada_em;
    expect(antes).toBe(sp('2026-11-17T09:00:00').toISOString());
    expect(depois).toBe(sp('2026-11-17T09:30:00').toISOString());
  });

  it('modo decisão usa o modelo profundo, com fallback de recusa; modo padrão usa o econômico', async () => {
    const x = await preparar();
    const dec = (await (await x.t.chamar('/api/conversas', { method: 'POST', headers: { cookie: x.cookie, origin: URL_TESTE, 'content-type': 'application/json' }, body: '{"tipo":"normal","modo":"decidir"}' })).json()) as { id: string };
    await (await x.enviar({ id: UUID(13), texto: 'oi' })).text();
    await (await x.enviar({ id: UUID(14), texto: 'preciso decidir' }, dec.id)).text();
    expect(x.pedidos[0]).toMatchObject({ modelo: 'claude-haiku-5-5', maxTokens: 1500, fallbackRecusa: false });
    expect(x.pedidos[1]).toMatchObject({ modelo: 'claude-sonnet-5-5', maxTokens: 4000, esforco: 'low', fallbackRecusa: true });
    expect(x.pedidos[1]!.sistemaVolatil).toContain('Modo decisão');
  });

  it('resposta cortada por max_tokens é gravada com " …" no fim', async () => {
    const x = await preparar([{ partes: ['Texto cortado'], truncada: true }]);
    await lerEventos(await x.enviar({ id: UUID(40), texto: 'oi' }));
    const j = await x.t.env.DB.prepare("SELECT texto FROM mensagens WHERE autor='jose'").first<{ texto: string }>();
    expect(j!.texto).toBe('Texto cortado …');
  });

  it('dois envios simultâneos do mesmo id não dão 500 e não duplicam a mensagem do Marco', async () => {
    const x = await preparar([{}, {}]);
    // Barreira: os dois envios leem "não existe" antes de qualquer um gravar (a corrida real).
    const db = x.t.env.DB;
    const prepararOrig = db.prepare.bind(db);
    let lidos = 0;
    let liberar!: () => void;
    const portao = new Promise<void>((r) => (liberar = r));
    db.prepare = ((sql: string) => {
      const st = prepararOrig(sql);
      if (sql !== 'SELECT * FROM mensagens WHERE id = ?') return st;
      return new Proxy(st, {
        get: (alvo, prop) => {
          if (prop !== 'bind') return Reflect.get(alvo, prop);
          return (...a: unknown[]) => {
            const b = alvo.bind(...a);
            return new Proxy(b, { get: (t2, p2) => (p2 === 'first' ? async () => { const r = await t2.first(); if (++lidos >= 2) liberar(); await portao; return r; } : Reflect.get(t2, p2)) });
          };
        },
      });
    }) as typeof db.prepare;
    const rs = await Promise.all([x.enviar({ id: UUID(41), texto: 'oi' }), x.enviar({ id: UUID(41), texto: 'oi' })]);
    for (const r of rs) {
      expect(r.status).toBe(200);
      await r.text();
    }
    expect(await x.contar("SELECT COUNT(*) AS n FROM mensagens WHERE autor='marco'")).toBe(1);
  });

  it('o contexto leva memórias, metas e tarefas do usuário (e só dele)', async () => {
    const x = await preparar();
    const u = (await x.t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
    await x.t.env.DB.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('o','o@x.com','O','2026-01-01T00:00:00Z')").run();
    const ag = '2026-11-01T00:00:00Z';
    await x.t.env.DB.batch([
      x.t.env.DB.prepare("INSERT INTO memorias(id,usuario_id,texto,area,origem,criada_em) VALUES('m1',?,'Acorda às 7h','saude','manual',?)").bind(u, ag),
      x.t.env.DB.prepare("INSERT INTO memorias(id,usuario_id,texto,area,origem,criada_em) VALUES('m2','o','Segredo alheio','casa','manual',?)").bind(ag),
      x.t.env.DB.prepare("INSERT INTO metas(id,usuario_id,titulo,area,origem,criada_em) VALUES('g1',?,'Meta ativa','trabalho','manual',?)").bind(u, ag),
      x.t.env.DB.prepare("INSERT INTO tarefas(id,usuario_id,titulo,area,prazo,origem,criada_em) VALUES('t1',?,'Sem prazo','casa',NULL,'manual','2026-11-05T00:00:00Z')").bind(u),
      x.t.env.DB.prepare("INSERT INTO tarefas(id,usuario_id,titulo,area,prazo,origem,criada_em) VALUES('t2',?,'Atrasada','casa','2026-11-10','manual','2026-11-04T00:00:00Z')").bind(u),
      x.t.env.DB.prepare("INSERT INTO tarefas(id,usuario_id,titulo,area,prazo,origem,criada_em) VALUES('t3',?,'De hoje','casa','2026-11-17','manual','2026-11-03T00:00:00Z')").bind(u),
      x.t.env.DB.prepare("INSERT INTO tarefas(id,usuario_id,titulo,area,prazo,origem,criada_em) VALUES('t4',?,'Futura','casa','2026-11-20','manual','2026-11-02T00:00:00Z')").bind(u),
    ]);
    await (await x.enviar({ id: UUID(15), texto: 'oi' })).text();
    const est = x.pedidos[0]!.sistemaEstavel;
    expect(est).toContain('Acorda às 7h');
    expect(est).toContain('Meta ativa');
    expect(est).not.toContain('Segredo alheio');
    expect(est.indexOf('Atrasada')).toBeLessThan(est.indexOf('De hoje'));
    expect(est.indexOf('De hoje')).toBeLessThan(est.indexOf('Futura'));
    expect(est.indexOf('Futura')).toBeLessThan(est.indexOf('Sem prazo'));
    expect(x.pedidos[0]!.sistemaVolatil).toContain('2026-11-17');
  });

  it('valida o corpo; conversa de outro usuário → 404; sem IA configurada → 500 claro', async () => {
    const x = await preparar();
    expect((await x.enviar({ id: '', texto: 'oi' })).status).toBe(400);
    expect((await x.enviar({ id: UUID(16), texto: 'a'.repeat(4001) })).status).toBe(400);
    expect((await x.enviar({ id: UUID(16), texto: 'oi' }, 'nao-existe')).status).toBe(404);
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    const { id } = (await (await t.chamar('/api/conversas', { method: 'POST', headers: { cookie, origin: URL_TESTE, 'content-type': 'application/json' }, body: '{"tipo":"normal"}' })).json()) as { id: string };
    const r = await t.chamar(`/api/conversas/${id}/mensagens`, { method: 'POST', headers: { cookie, origin: URL_TESTE, 'content-type': 'application/json' }, body: JSON.stringify({ id: UUID(17), texto: 'oi', origem: 'texto' }) });
    expect(r.status).toBe(500);
    expect(((await r.json()) as { erro: { codigo: string } }).erro.codigo).toBe('ia_indisponivel');
  });

  it('sugestões: valida com Zod, ignora o que passar de 3 e grava como pendentes', async () => {
    const tarefa = (n: number) => ({ nome: 'sugerir_tarefa', entrada: { titulo: `T${n}`, area: 'casa' } });
    const x = await preparar([{ partes: ['Anotei.'], sugestoes: [tarefa(1), { nome: 'sugerir_meta', entrada: { titulo: '', area: 'casa' } }, tarefa(2), tarefa(3), tarefa(4)] }], { sugestoesAtivas: ['tarefa', 'meta', 'memoria'] });
    const eventos = await lerEventos(await x.enviar({ id: UUID(18), texto: 'preciso fazer 4 coisas' }));
    expect(eventos.map((e) => e.evento)).toEqual(['texto', 'sugestao', 'sugestao', 'sugestao', 'fim']);
    expect(x.pedidos[0]).toMatchObject({ ferramentas: ['tarefa', 'meta', 'memoria'] });
    expect(x.pedidos[0]!.sistemaEstavel).toContain('Sugestões (ferramentas)');
    const linhas = (await x.t.env.DB.prepare('SELECT tipo, status, conteudo FROM sugestoes ORDER BY rowid').all<{ tipo: string; status: string; conteudo: string }>()).results;
    expect(linhas.map((l) => [l.tipo, l.status, JSON.parse(l.conteudo).titulo])).toEqual([['tarefa', 'pendente', 'T1'], ['tarefa', 'pendente', 'T2'], ['tarefa', 'pendente', 'T3']]);
  });

  describe('sugerir_memoria (tarefa 4.1)', () => {
    const memoria = (texto: string, area = 'saude') => ({ nome: 'sugerir_memoria', entrada: { texto, area } });
    const aviso = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

    it('o texto vem antes: o evento `sugestao` traz id, tipo e conteudo, e a linha fica pendente', async () => {
      const x = await preparar([{ partes: ['Boa, ', 'anotei.'], sugestoes: [memoria('Acorda às 6h.')] }], { sugestoesAtivas: ['memoria'] });
      const eventos = await lerEventos(await x.enviar({ id: UUID(30), texto: 'eu acordo às 6h' }));
      expect(eventos.map((e) => e.evento)).toEqual(['texto', 'texto', 'sugestao', 'fim']);
      expect(eventos[2]!.dados).toMatchObject({ tipo: 'memoria', conteudo: { texto: 'Acorda às 6h.', area: 'saude' } });
      const linha = await x.t.env.DB.prepare('SELECT id, tipo, status, item_id FROM sugestoes').first<{ id: string; tipo: string; status: string; item_id: string | null }>();
      expect(linha).toMatchObject({ id: eventos[2]!.dados.id, tipo: 'memoria', status: 'pendente', item_id: null });
      expect(x.pedidos[0]!.ferramentas).toEqual(['memoria']);
      expect(x.pedidos).toHaveLength(1); // nenhuma segunda chamada depois da ferramenta
      expect(x.pedidos[0]!.sistemaEstavel).toContain('`sugerir_memoria`');
      expect(x.pedidos[0]!.sistemaEstavel).not.toContain('sugerir_tarefa');
    });

    it('a 4ª sugestão é ignorada e o conteúdo inválido é descartado com registro no log (sem o conteúdo)', async () => {
      const log = aviso();
      const x = await preparar([{ partes: ['Anotei.'], sugestoes: [memoria('A'), memoria('B'), memoria('x'.repeat(301)), memoria('C'), memoria('D'), { nome: 'sugerir_memoria', entrada: { texto: 'E', area: 'nao_existe' } }] }], { sugestoesAtivas: ['memoria'] });
      const eventos = await lerEventos(await x.enviar({ id: UUID(31), texto: 'muita coisa' }));
      expect(eventos.filter((e) => e.evento === 'sugestao').map((e) => (e.dados.conteudo as { texto: string }).texto)).toEqual(['A', 'B', 'C']);
      const motivos = log.mock.calls.filter((c) => c[0] === 'ia sugestão descartada').map((c) => (c[1] as { motivo: string }).motivo);
      expect(motivos).toEqual(['invalida', 'acima_do_limite', 'invalida']);
      expect(log.mock.calls.find((c) => (c[1] as { motivo: string }).motivo === 'invalida')![1]).toMatchObject({ ferramenta: 'sugerir_memoria', campos: ['texto'] });
      expect(JSON.stringify(log.mock.calls)).not.toContain('xxxxx');
      log.mockRestore();
    });

    it('ignora ferramenta que não está ligada (tarefa e meta ficam para a onda 5) e ferramenta desconhecida', async () => {
      const log = aviso();
      const x = await preparar([{ sugestoes: [{ nome: 'sugerir_tarefa', entrada: { titulo: 'T', area: 'casa' } }, { nome: 'sugerir_meta', entrada: { titulo: 'M', area: 'casa' } }, { nome: 'apagar_tudo', entrada: {} }, memoria('Corre às terças.')] }], { sugestoesAtivas: ['memoria'] });
      const eventos = await lerEventos(await x.enviar({ id: UUID(32), texto: 'oi' }));
      expect(eventos.filter((e) => e.evento === 'sugestao')).toHaveLength(1);
      expect(log.mock.calls.map((c) => (c[1] as { motivo: string }).motivo)).toEqual(['desligada', 'desligada', 'ferramenta_desconhecida']);
      log.mockRestore();
    });

    it('não repete uma memória que já existe (mesmo com outra pontuação ou acento) nem duas iguais na mesma resposta', async () => {
      const log = aviso();
      const x = await preparar([{ sugestoes: [memoria('acorda as 6H'), memoria('Trabalha de casa às sextas.', 'trabalho'), memoria('trabalha de CASA as sextas', 'trabalho')] }], { sugestoesAtivas: ['memoria'] });
      const usuario = (await x.t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
      await x.t.env.DB.prepare("INSERT INTO memorias (id, usuario_id, texto, area, origem, criada_em) VALUES ('m1', ?, 'Acorda às 6h.', 'saude', 'manual', '2026-11-01T00:00:00Z')").bind(usuario).run();
      const eventos = await lerEventos(await x.enviar({ id: UUID(33), texto: 'oi' }));
      expect(eventos.filter((e) => e.evento === 'sugestao').map((e) => (e.dados.conteudo as { texto: string }).texto)).toEqual(['Trabalha de casa às sextas.']);
      expect(log.mock.calls.map((c) => (c[1] as { motivo: string }).motivo)).toEqual(['memoria_repetida', 'memoria_repetida']);
      log.mockRestore();
    });

    it('reenviar uma mensagem já respondida repete as sugestões com o status e o item_id gravados', async () => {
      const x = await preparar([{ partes: ['Anotei.'], sugestoes: [memoria('A'), memoria('B', 'casa'), memoria('C', 'trabalho')] }], { sugestoesAtivas: ['memoria'] });
      const primeira = await lerEventos(await x.enviar({ id: UUID(36), texto: 'três fatos' }));
      const ids = primeira.filter((e) => e.evento === 'sugestao').map((e) => e.dados.id);
      expect(primeira.filter((e) => e.evento === 'sugestao').map((e) => [e.dados.status, e.dados.item_id])).toEqual([['pendente', null], ['pendente', null], ['pendente', null]]);
      await x.t.env.DB.prepare("UPDATE sugestoes SET status='salva', item_id='mem1' WHERE id=?").bind(ids[0]).run();
      await x.t.env.DB.prepare("UPDATE sugestoes SET status='descartada' WHERE id=?").bind(ids[1]).run();
      const de = await lerEventos(await x.enviar({ id: UUID(36), texto: 'três fatos' }));
      expect(de.filter((e) => e.evento === 'sugestao').map((e) => [e.dados.id, e.dados.status, e.dados.item_id])).toEqual([
        [ids[0], 'salva', 'mem1'], [ids[1], 'descartada', null], [ids[2], 'pendente', null],
      ]);
      expect(x.pedidos).toHaveLength(1); // não chamou a IA de novo
    });

    it('se o modelo só chamar a ferramenta, a resposta ganha um texto curto (a mensagem nunca fica vazia)', async () => {
      const x = await preparar([{ partes: [], sugestoes: [memoria('Tem um filho pequeno.', 'casa')] }], { sugestoesAtivas: ['memoria'] });
      const eventos = await lerEventos(await x.enviar({ id: UUID(34), texto: 'tenho um filho pequeno' }));
      expect(eventos.map((e) => e.evento)).toEqual(['texto', 'sugestao', 'fim']);
      expect((await x.t.env.DB.prepare("SELECT texto FROM mensagens WHERE autor='jose'").first<{ texto: string }>())!.texto).toBe(eventos[0]!.dados.delta);
    });

    it('sem texto e sem sugestão válida continua sendo erro', async () => {
      const x = await preparar([{ partes: [], sugestoes: [memoria('x'.repeat(400))] }], { sugestoesAtivas: ['memoria'] });
      const eventos = await lerEventos(await x.enviar({ id: UUID(35), texto: 'oi' }));
      expect(eventos.map((e) => e.evento)).toEqual(['erro']);
    });

    it('a configuração padrão do app liga só a memória', () => {
      expect(dependenciasPadrao.sugestoesAtivas).toEqual(['memoria']);
    });

    it('as memórias salvas entram no contexto de toda resposta, e o prompt orienta a não repetir', async () => {
      const x = await preparar([{}], { sugestoesAtivas: ['memoria'] });
      const usuario = (await x.t.env.DB.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
      await x.t.env.DB.prepare("INSERT INTO memorias (id, usuario_id, texto, area, origem, criada_em) VALUES ('m1', ?, 'Acorda às 6h.', 'saude', 'manual', '2026-11-01T00:00:00Z')").bind(usuario).run();
      await (await x.enviar({ id: UUID(36), texto: 'o que faço hoje?' })).text();
      const estavel = x.pedidos[0]!.sistemaEstavel;
      expect(estavel).toContain('- [Saúde e rotina] Acorda às 6h.');
      expect(estavel).toMatch(/Não sugira uma memória que já está na lista de memórias/);
      expect(estavel.indexOf('Acorda às 6h.')).toBeGreaterThan(estavel.indexOf('Sugestões (ferramentas)')); // memórias depois do prompt, antes das tarefas (cache)
    });
  });

  it('por padrão (onda 2) as ferramentas de sugestão ficam desligadas', async () => {
    const x = await preparar();
    await (await x.enviar({ id: UUID(19), texto: 'oi' })).text();
    expect(x.pedidos[0]!.ferramentas).toEqual([]);
    expect(x.pedidos[0]!.sistemaEstavel).not.toContain('Sugestões (ferramentas)');
  });
});
