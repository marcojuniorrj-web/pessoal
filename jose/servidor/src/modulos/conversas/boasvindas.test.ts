import { describe, expect, it } from 'vitest';
import { etapaBoasVindas, PERGUNTAS_BOAS_VINDAS } from '@compartilhado/boasvindas';
import { ErroIA } from '../../adaptadores/ia/tipos';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';
import { criarIaFalsa, lerEventos, type Passo } from '../../../testes/ia-falsa';

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AGORA = new Date('2026-11-18T13:00:00Z');
const memoria = (texto: string, area = 'saude') => ({ nome: 'sugerir_memoria', entrada: { texto, area } });

async function preparar(roteiro: Passo[] = [{ partes: ['Obrigado, Marco. Veja o que entendi.'], sugestoes: [memoria('Acorda às 6h.'), memoria('Dorme às 22h30.')] }], env: Record<string, string> = {}) {
  const falsa = criarIaFalsa(roteiro);
  const t = criarAppTeste({ ia: falsa.ia, agora: () => AGORA, sugestoesAtivas: ['memoria', 'tarefa', 'meta'], env });
  const { cookie } = await entrar(t);
  const cab = { cookie, origin: URL_TESTE, 'content-type': 'application/json' };
  const api = (caminho: string, metodo = 'GET', corpo?: unknown) => t.chamar(caminho, { method: metodo, headers: cab, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const db = t.env.DB;
  const contar = async (sql: string) => (await db.prepare(sql).first<{ n: number }>())!.n;
  const criar = async () => ((await (await api('/api/conversas', 'POST', { tipo: 'boas_vindas' })).json()) as { id: string }).id;
  const responder = async (id: string, n: number, texto = `resposta ${n}`) =>
    lerEventos(await api(`/api/conversas/${id}/mensagens`, 'POST', { id: UUID(n), texto, origem: 'texto' }));
  const eu = async () => (await (await api('/api/eu')).json()) as Record<string, unknown>;
  const mensagens = async (id: string) => ((await (await api(`/api/conversas/${id}`)).json()) as { mensagens: Array<{ autor: 'marco' | 'jose'; texto: string; modelo: string | null }> }).mensagens;
  return { t, api, db, contar, criar, responder, eu, mensagens, ...falsa };
}

describe('POST /api/conversas {tipo: boas_vindas}', () => {
  it('cria a conversa com a 1ª pergunta fixa como mensagem do José (sem IA, modelo nulo) e título fixo', async () => {
    const x = await preparar();
    const r = await x.api('/api/conversas', 'POST', { tipo: 'boas_vindas' });
    expect(r.status).toBe(201);
    const { id } = (await r.json()) as { id: string };
    const c = await x.db.prepare('SELECT tipo, modo, titulo FROM conversas WHERE id = ?').bind(id).first();
    expect(c).toEqual({ tipo: 'boas_vindas', modo: 'padrao', titulo: 'Boas-vindas' });
    expect(await x.mensagens(id)).toEqual([expect.objectContaining({ autor: 'jose', texto: PERGUNTAS_BOAS_VINDAS[0]!.texto, origem: 'texto', modelo: null })]);
    expect(x.pedidos).toHaveLength(0);
  });
  it('ignora o modo decisão pedido junto (boas-vindas é sempre modo padrão)', async () => {
    const x = await preparar();
    const id = ((await (await x.api('/api/conversas', 'POST', { tipo: 'boas_vindas', modo: 'decidir' })).json()) as { id: string }).id;
    expect((await x.db.prepare('SELECT modo FROM conversas WHERE id = ?').bind(id).first<{ modo: string }>())!.modo).toBe('padrao');
  });
});

describe('as 5 etapas', () => {
  it('respostas 1 a 4 recebem a próxima pergunta fixa, sem IA e sem contar no limite diário', async () => {
    const x = await preparar([{}], { LIMITE_MENSAGENS_DIA: '1' });
    const id = await x.criar();
    // o limite diário já está esgotado: as perguntas fixas continuam funcionando
    await x.db.prepare("INSERT INTO uso_diario (usuario_id, dia, respostas) SELECT id, '2026-11-18', 1 FROM usuarios").run();
    for (let n = 1; n <= 4; n++) {
      const eventos = await x.responder(id, n);
      expect(eventos.map((e) => e.evento)).toEqual(['texto', 'fim']);
      expect(eventos[0]!.dados.delta).toBe(PERGUNTAS_BOAS_VINDAS[n]!.texto);
    }
    expect(x.pedidos).toHaveLength(0);
    expect(x.pedidosTitulo).toHaveLength(0);
    expect(await x.contar('SELECT respostas AS n FROM uso_diario')).toBe(1); // não subiu
    const msgs = await x.mensagens(id);
    expect(msgs.map((m) => m.autor)).toEqual(['jose', 'marco', 'jose', 'marco', 'jose', 'marco', 'jose', 'marco', 'jose']);
    expect(msgs.filter((m) => m.autor === 'jose').every((m) => m.modelo === null)).toBe(true);
    expect(etapaBoasVindas(msgs)).toEqual({ fase: 'perguntando', numero: 5, respostas: 4 });
  });

  it('a 5ª resposta chama a IA (modelo padrão, só memória, memórias atuais no contexto) e grava as sugestões pendentes', async () => {
    const x = await preparar();
    await x.db.prepare("INSERT INTO memorias (id, usuario_id, texto, area, origem, criada_em) SELECT 'm0', id, 'Trabalha como gerente comercial.', 'trabalho', 'manual', '2026-11-01T00:00:00Z' FROM usuarios").run();
    const id = await x.criar();
    for (let n = 1; n <= 4; n++) await x.responder(id, n);
    const eventos = await x.responder(id, 5, 'Acordo às 6h e durmo às 22h30.');
    expect(eventos.map((e) => e.evento)).toEqual(['texto', 'sugestao', 'sugestao', 'fim']);
    expect(eventos.filter((e) => e.evento === 'sugestao').map((e) => e.dados.status)).toEqual(['pendente', 'pendente']);

    expect(x.pedidos).toHaveLength(1);
    const p = x.pedidos[0]!;
    expect(p.modelo).toBe('claude-haiku-5-5');
    expect(p.ferramentas).toEqual(['memoria']); // tarefa e meta ficam desligadas aqui
    expect(p.sistemaEstavel).toContain('Trabalha como gerente comercial.');
    expect(p.sistemaEstavel).toContain('sugerir_memoria');
    expect(p.sistemaEstavel).not.toContain('sugerir_tarefa');
    expect(p.sistemaVolatil).toContain('Fim das boas-vindas');
    // a conversa vai inteira, começando por "user" (a 1ª pergunta do José não se perde)
    expect(p.mensagens[0]!.papel).toBe('user');
    expect(p.mensagens.map((m) => m.texto).join('\n')).toContain(PERGUNTAS_BOAS_VINDAS[0]!.texto);
    expect(p.mensagens.at(-1)).toEqual({ papel: 'user', texto: 'Acordo às 6h e durmo às 22h30.' });
    expect(await x.contar("SELECT COUNT(*) AS n FROM sugestoes WHERE status = 'pendente'")).toBe(2);
    expect(await x.contar('SELECT respostas AS n FROM uso_diario')).toBe(1); // a chamada de IA conta
    expect(await x.contar("SELECT COUNT(*) AS n FROM memorias")).toBe(1); // nada salvo sozinho
    expect(x.pedidosTitulo).toHaveLength(0); // título fixo: nenhuma chamada de título
    expect(etapaBoasVindas(await x.mensagens(id))).toEqual({ fase: 'revisando', respostas: 5 });
  });

  it('aceita até 8 memórias (nas outras conversas o limite é 3), ignora tarefa/meta e a memória que já existe', async () => {
    const muitas = Array.from({ length: 10 }, (_, i) => memoria(`Fato duradouro número ${i}.`));
    const x = await preparar([{ partes: ['Veja.'], sugestoes: [memoria('Acorda às 6h.'), { nome: 'sugerir_tarefa', entrada: { titulo: 'Correr', area: 'saude' } }, ...muitas] }]);
    await x.db.prepare("INSERT INTO memorias (id, usuario_id, texto, area, origem, criada_em) SELECT 'm0', id, 'Acorda às 6h.', 'saude', 'manual', '2026-11-01T00:00:00Z' FROM usuarios").run();
    const id = await x.criar();
    for (let n = 1; n <= 4; n++) await x.responder(id, n);
    const eventos = await x.responder(id, 5);
    expect(eventos.filter((e) => e.evento === 'sugestao')).toHaveLength(8);
    expect(await x.contar("SELECT COUNT(*) AS n FROM sugestoes WHERE tipo <> 'memoria'")).toBe(0);
    expect(await x.contar("SELECT COUNT(*) AS n FROM sugestoes WHERE conteudo LIKE '%Acorda%'")).toBe(0);
  });

  it('uma 6ª mensagem na conversa de boas-vindas é recusada (409) e nada é gravado', async () => {
    const x = await preparar();
    const id = await x.criar();
    for (let n = 1; n <= 5; n++) await x.responder(id, n);
    const antes = await x.contar('SELECT COUNT(*) AS n FROM mensagens');
    const r = await x.api(`/api/conversas/${id}/mensagens`, 'POST', { id: UUID(6), texto: 'mais uma', origem: 'texto' });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { erro: { codigo: string } }).erro.codigo).toBe('boas_vindas_completa');
    expect(await x.contar('SELECT COUNT(*) AS n FROM mensagens')).toBe(antes);
  });

  it('o limite diário vale na chamada de IA (429) e a resposta fica gravada para o Tentar de novo', async () => {
    const x = await preparar([{}], { LIMITE_MENSAGENS_DIA: '1' });
    const id = await x.criar();
    await x.db.prepare("INSERT INTO uso_diario (usuario_id, dia, respostas) SELECT id, '2026-11-18', 1 FROM usuarios").run();
    for (let n = 1; n <= 4; n++) await x.responder(id, n);
    const r = await x.api(`/api/conversas/${id}/mensagens`, 'POST', { id: UUID(5), texto: 'resposta 5', origem: 'texto' });
    expect(r.status).toBe(429);
  });

  it('sem IA configurada: as perguntas fixas funcionam; só o resumo dá 500', async () => {
    const t = criarAppTeste({ agora: () => AGORA });
    const { cookie } = await entrar(t);
    const cab = { cookie, origin: URL_TESTE, 'content-type': 'application/json' };
    const { id } = (await (await t.chamar('/api/conversas', { method: 'POST', headers: cab, body: '{"tipo":"boas_vindas"}' })).json()) as { id: string };
    const enviar = (n: number) => t.chamar(`/api/conversas/${id}/mensagens`, { method: 'POST', headers: cab, body: JSON.stringify({ id: UUID(n), texto: 'x', origem: 'texto' }) });
    for (let n = 1; n <= 4; n++) expect((await enviar(n)).status).toBe(200);
    expect((await enviar(5)).status).toBe(500);
  });
});

describe('tentar de novo e retomada', () => {
  it('repetir o mesmo id de uma resposta devolve a mesma pergunta, sem duplicar nada', async () => {
    const x = await preparar();
    const id = await x.criar();
    const a = await x.responder(id, 1);
    const b = await x.responder(id, 1);
    expect(b[0]!.dados.delta).toBe(a[0]!.dados.delta);
    expect(b.at(-1)!.dados.mensagem_id).toBe(a.at(-1)!.dados.mensagem_id);
    expect(await x.mensagens(id)).toHaveLength(3); // pergunta 1, resposta 1, pergunta 2
  });

  it('a IA falha no resumo: a 5ª resposta fica gravada e o Tentar de novo (mesmo id) gera o resumo uma única vez', async () => {
    const x = await preparar([{ erro: new ErroIA('indisponivel', 'x'), partes: [] }, { partes: ['Veja.'], sugestoes: [memoria('Dorme às 22h30.')] }]);
    const id = await x.criar();
    for (let n = 1; n <= 4; n++) await x.responder(id, n);
    expect((await x.responder(id, 5)).map((e) => e.evento)).toEqual(['erro']);
    expect(etapaBoasVindas(await x.mensagens(id))).toMatchObject({ fase: 'resumindo', respostas: 5 });
    expect((await x.responder(id, 5)).map((e) => e.evento)).toEqual(['texto', 'sugestao', 'fim']);
    expect(await x.contar("SELECT COUNT(*) AS n FROM mensagens WHERE autor = 'marco'")).toBe(5);
    expect(await x.contar("SELECT COUNT(*) AS n FROM sugestoes")).toBe(1);
  });

  it('GET /api/eu devolve a conversa em aberto até as boas-vindas serem concluídas (retomada)', async () => {
    const x = await preparar();
    expect(await x.eu()).toMatchObject({ boas_vindas_concluida: false });
    expect(await x.eu()).not.toHaveProperty('conversa_boas_vindas_id');
    const id = await x.criar();
    await x.responder(id, 1);
    await x.responder(id, 2);
    // "fechou o app na pergunta 3": ao reabrir, o /api/eu aponta a conversa e ela mostra a etapa certa
    expect(await x.eu()).toMatchObject({ boas_vindas_concluida: false, conversa_boas_vindas_id: id });
    expect(etapaBoasVindas(await x.mensagens(id))).toEqual({ fase: 'perguntando', numero: 3, respostas: 2 });
  });

  it('com mais de uma conversa de boas-vindas (refazer abandonado), retoma a mais recente', async () => {
    let agora = AGORA;
    const falsa = criarIaFalsa([{}]);
    const t = criarAppTeste({ ia: falsa.ia, agora: () => agora });
    const { cookie } = await entrar(t);
    const cab = { cookie, origin: URL_TESTE, 'content-type': 'application/json' };
    const nova = async () => ((await (await t.chamar('/api/conversas', { method: 'POST', headers: cab, body: '{"tipo":"boas_vindas"}' })).json()) as { id: string }).id;
    await nova();
    agora = new Date(AGORA.getTime() + 60_000);
    const segunda = await nova();
    const eu = (await (await t.chamar('/api/eu', { headers: { cookie } })).json()) as { conversa_boas_vindas_id: string };
    expect(eu.conversa_boas_vindas_id).toBe(segunda);
  });
});

describe('Pular e concluir (POST /api/eu/boas-vindas)', () => {
  it('Pular conclui sem nenhuma conversa e sem salvar nada; é idempotente', async () => {
    const x = await preparar();
    expect((await x.api('/api/eu/boas-vindas', 'POST')).status).toBe(204);
    expect((await x.api('/api/eu/boas-vindas', 'POST')).status).toBe(204);
    expect(await x.eu()).toEqual(expect.objectContaining({ boas_vindas_concluida: true }));
    expect(await x.eu()).not.toHaveProperty('conversa_boas_vindas_id');
    expect(await x.contar('SELECT COUNT(*) AS n FROM memorias')).toBe(0);
  });
  it('Pular no meio das perguntas conclui e o Chat nunca fica preso', async () => {
    const x = await preparar();
    const id = await x.criar();
    await x.responder(id, 1);
    expect((await x.api('/api/eu/boas-vindas', 'POST')).status).toBe(204);
    expect(await x.eu()).toMatchObject({ boas_vindas_concluida: true });
  });
  it('exige sessão e Origin', async () => {
    const x = await preparar();
    expect((await x.t.chamar('/api/eu/boas-vindas', { method: 'POST', headers: { origin: URL_TESTE } })).status).toBe(401);
    expect((await x.t.chamar('/api/eu/boas-vindas', { method: 'POST', headers: { origin: 'https://outro.site' } })).status).toBe(403);
  });
});

describe('a conversa de boas-vindas fica fora do resto', () => {
  it('não aparece no Histórico nem como conversa de hoje', async () => {
    const x = await preparar();
    const id = await x.criar();
    await x.api('/api/conversas', 'POST', { tipo: 'normal' });
    // a conversa de hoje é só a `normal` (a de boas-vindas, mesmo sendo a mais recente, nunca vale)
    const hoje = (await (await x.api('/api/conversas/hoje')).json()) as { conversa: { tipo: string } };
    expect(hoje.conversa.tipo).toBe('normal');
    const lista = (await (await x.api('/api/conversas')).json()) as Array<{ id: string; tipo: string }>;
    expect(lista.map((c) => c.tipo)).toEqual(['normal']);
    expect(lista.map((c) => c.id)).not.toContain(id);
  });
  it('nunca é apagada por ficar sem mensagens', async () => {
    const x = await preparar();
    const id = await x.criar();
    const msg = (await x.db.prepare('SELECT id FROM mensagens WHERE conversa_id = ?').bind(id).first<{ id: string }>())!.id;
    const r = await x.api(`/api/mensagens/${msg}`, 'DELETE');
    expect(r.status).toBe(204); // sem { conversa_apagada: true }
    expect(await x.contar('SELECT COUNT(*) AS n FROM conversas')).toBe(1);
  });
});

describe('POST /api/conversas/:id/sugestoes/lote', () => {
  /** Conversa de boas-vindas pronta, com 4 sugestões de memória pendentes. */
  async function comLista() {
    const x = await preparar([{ partes: ['Veja o que entendi.'], sugestoes: [memoria('Acorda às 6h.'), memoria('Dorme às 22h30.'), memoria('Quer correr uma meia-maratona.', 'sobre_mim'), memoria('Trava ao começar tarefas grandes.', 'sobre_mim')] }]);
    const id = await x.criar();
    for (let n = 1; n <= 5; n++) await x.responder(id, n);
    const ids = ((await x.db.prepare('SELECT id FROM sugestoes ORDER BY rowid').all<{ id: string }>()).results).map((s) => s.id);
    const lote = (corpo: unknown, conversa = id) => x.api(`/api/conversas/${conversa}/sugestoes/lote`, 'POST', corpo);
    return { ...x, id, ids, lote };
  }

  it('salva as marcadas (com o texto e a área editados), descarta as desmarcadas, grava origem boas_vindas e conclui, tudo junto', async () => {
    const x = await comLista();
    const r = await x.lote({ salvar: [{ id: x.ids[0]! }, { id: x.ids[2]!, conteudo: { texto: 'Quer correr a meia-maratona de 2027.', area: 'saude' } }], descartar: [x.ids[1]!, x.ids[3]!] });
    expect(r.status).toBe(200);
    const { itens } = (await r.json()) as { itens: Array<Record<string, unknown>> };
    expect(itens).toEqual([
      expect.objectContaining({ texto: 'Acorda às 6h.', area: 'saude', origem: 'boas_vindas' }),
      expect.objectContaining({ texto: 'Quer correr a meia-maratona de 2027.', area: 'saude', origem: 'boas_vindas' }),
    ]);
    expect(itens[0]).not.toHaveProperty('usuario_id');
    const sug = (await x.db.prepare('SELECT status, item_id FROM sugestoes ORDER BY rowid').all<{ status: string; item_id: string | null }>()).results;
    expect(sug.map((s) => s.status)).toEqual(['salva', 'descartada', 'salva', 'descartada']);
    expect(sug[0]!.item_id).toBe(itens[0]!.id);
    expect(sug[1]!.item_id).toBeNull();
    // aparece em José sabe e a flag foi concluída na mesma operação
    expect(((await (await x.api('/api/memorias')).json()) as unknown[]).length).toBe(2);
    expect(await x.eu()).toMatchObject({ boas_vindas_concluida: true });
  });

  it('reenviar o mesmo lote não duplica nada (as já tratadas são ignoradas) e um cartão tratado nunca volta a pendente', async () => {
    const x = await comLista();
    const corpo = { salvar: [{ id: x.ids[0]! }], descartar: [x.ids[1]!] };
    expect((await x.lote(corpo)).status).toBe(200);
    const r = await x.lote(corpo);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { itens: unknown[] }).itens).toEqual([]);
    expect(await x.contar('SELECT COUNT(*) AS n FROM memorias')).toBe(1);
    // trocar a decisão depois também é ignorado: a descartada não vira salva
    await x.lote({ salvar: [{ id: x.ids[1]! }], descartar: [] });
    expect(await x.contar('SELECT COUNT(*) AS n FROM memorias')).toBe(1);
    expect((await x.db.prepare('SELECT status FROM sugestoes WHERE id = ?').bind(x.ids[1]).first<{ status: string }>())!.status).toBe('descartada');
  });

  it('é uma transação: um texto inválido (301 caracteres) dá 400 e nada muda (nem a flag)', async () => {
    const x = await comLista();
    const r = await x.lote({ salvar: [{ id: x.ids[0]! }, { id: x.ids[2]!, conteudo: { texto: 'x'.repeat(301), area: 'casa' } }], descartar: [x.ids[1]!] });
    expect(r.status).toBe(400);
    expect(await x.contar("SELECT COUNT(*) AS n FROM sugestoes WHERE status = 'pendente'")).toBe(4);
    expect(await x.contar('SELECT COUNT(*) AS n FROM memorias')).toBe(0);
    expect(await x.eu()).toMatchObject({ boas_vindas_concluida: false });
  });

  it('se o banco falha no meio, nada é gravado (rollback)', async () => {
    const x = await comLista();
    // o 2º salvar já tem uma memória com o mesmo id? simula: tabela de memórias que recusa a segunda inserção
    await x.db.exec("CREATE TRIGGER falha BEFORE INSERT ON memorias WHEN (SELECT COUNT(*) FROM memorias) >= 1 BEGIN SELECT RAISE(ABORT, 'falhou'); END");
    const r = await x.lote({ salvar: [{ id: x.ids[0]! }, { id: x.ids[1]! }], descartar: [x.ids[2]!] });
    expect(r.status).toBe(500);
    expect(await x.contar('SELECT COUNT(*) AS n FROM memorias')).toBe(0);
    expect(await x.contar("SELECT COUNT(*) AS n FROM sugestoes WHERE status = 'pendente'")).toBe(4);
    expect(await x.eu()).toMatchObject({ boas_vindas_concluida: false });
  });

  it('as sugestões que não foram citadas continuam pendentes; lote vazio só conclui', async () => {
    const x = await comLista();
    expect((await x.lote({ salvar: [{ id: x.ids[0]! }], descartar: [] })).status).toBe(200);
    expect(await x.contar("SELECT COUNT(*) AS n FROM sugestoes WHERE status = 'pendente'")).toBe(3);
    expect((await x.lote({ salvar: [], descartar: [] })).status).toBe(200);
  });

  it('corpo inválido, ids repetidos ou acima de 20 → 400', async () => {
    const x = await comLista();
    for (const corpo of [null, {}, { salvar: [], descartar: 'x' }, { salvar: [{ id: x.ids[0]! }], descartar: [x.ids[0]!] }, { salvar: [], descartar: Array.from({ length: 21 }, (_, i) => `s${i}`) }]) {
      expect((await x.lote(corpo)).status, JSON.stringify(corpo)).toBe(400);
    }
    expect(await x.contar("SELECT COUNT(*) AS n FROM sugestoes WHERE status = 'pendente'")).toBe(4);
  });

  it('posse: id de outra conversa ou inexistente → 404; conversa de outro usuário → 404; conversa normal → 400', async () => {
    const x = await comLista();
    const dono = (await x.db.prepare('SELECT id FROM usuarios').first<{ id: string }>())!.id;
    await x.db.prepare("INSERT INTO usuarios(id,email,nome,criado_em) VALUES('outro','outro@x.com','Outro','2026-01-01T00:00:00Z')").run();
    await x.db.prepare("INSERT INTO conversas(id,usuario_id,titulo,tipo,modo,criada_em,atualizada_em) VALUES('c-outro','outro','Boas-vindas','boas_vindas','padrao','2026-11-18T09:00:00Z','2026-11-18T09:00:00Z')").run();
    await x.db.prepare("INSERT INTO conversas(id,usuario_id,titulo,tipo,modo,criada_em,atualizada_em) VALUES('c-normal',?,NULL,'normal','padrao','2026-11-18T09:00:00Z','2026-11-18T09:00:00Z')").bind(dono).run();
    await x.db.prepare("INSERT INTO mensagens(id,conversa_id,autor,texto,origem,criada_em) VALUES('m-outro','c-outro','jose','x','texto','2026-11-18T09:00:00Z')").run();
    await x.db.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,criada_em) VALUES('s-outro','m-outro','memoria','{\"texto\":\"a\",\"area\":\"casa\"}','2026-11-18T09:00:00Z')").run();
    expect((await x.lote({ salvar: [{ id: 's-outro' }], descartar: [] })).status).toBe(404);
    expect((await x.lote({ salvar: [{ id: 'nao-existe' }], descartar: [] })).status).toBe(404);
    expect((await x.lote({ salvar: [], descartar: [] }, 'c-outro')).status).toBe(404);
    expect((await x.lote({ salvar: [], descartar: [] }, 'c-normal')).status).toBe(400);
    expect(await x.eu()).toMatchObject({ boas_vindas_concluida: false });
    expect((await x.db.prepare("SELECT status FROM sugestoes WHERE id = 's-outro'").first<{ status: string }>())!.status).toBe('pendente');
  });

  it('só memórias entram no lote (tarefa ou meta → 400)', async () => {
    const x = await comLista();
    await x.db.prepare("INSERT INTO sugestoes(id,mensagem_id,tipo,conteudo,criada_em) SELECT 'st', mensagem_id, 'tarefa', '{\"titulo\":\"Ligar\",\"area\":\"casa\"}', criada_em FROM sugestoes LIMIT 1").run();
    expect((await x.lote({ salvar: [{ id: 'st' }], descartar: [] })).status).toBe(400);
  });

  it('exige o Origin do app', async () => {
    const x = await comLista();
    const r = await x.t.chamar(`/api/conversas/${x.id}/sugestoes/lote`, { method: 'POST', headers: { cookie: (await entrar(x.t)).cookie, origin: 'https://outro.site', 'content-type': 'application/json' }, body: '{"salvar":[],"descartar":[]}' });
    expect(r.status).toBe(403);
  });
});

describe('refazer as boas-vindas (nova conversa, memórias atuais no contexto)', () => {
  it('abre uma nova conversa mesmo com as boas-vindas concluídas e não mexe na flag', async () => {
    const x = await preparar();
    await x.api('/api/eu/boas-vindas', 'POST');
    const id = await x.criar();
    expect(await x.eu()).toMatchObject({ boas_vindas_concluida: true });
    expect(await x.eu()).not.toHaveProperty('conversa_boas_vindas_id');
    for (let n = 1; n <= 5; n++) await x.responder(id, n);
    expect(x.pedidos).toHaveLength(1);
    expect(x.pedidos[0]!.sistemaEstavel).toContain('O que você sabe sobre o Marco (memórias)');
  });
});
