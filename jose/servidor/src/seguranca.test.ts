// Revisão de segurança (tarefa 7.4): isolamento entre usuários em TODAS as rotas /:id, Origin, cookies e logs sem conteúdo.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroIA } from './adaptadores/ia/tipos';
import { sha256Hex } from './compartilhado/cripto';
import { criarAppTeste, entrar, URL_TESTE } from '../testes/ambiente';
import { criarIaFalsa, lerEventos } from '../testes/ia-falsa';
import { contarTabelas, semearUsuario, type Semeado } from '../testes/semear';

type T = ReturnType<typeof criarAppTeste>;
const JSON_H = { 'content-type': 'application/json' };

/** Cria uma sessão válida para um usuário já semeado e devolve o cookie. */
async function cookieDe(t: T, usuarioId: string, token: string) {
  await t.env.DB.prepare('INSERT INTO sessoes(id,usuario_id,expira_em,criada_em) VALUES(?,?,?,?)').bind(await sha256Hex(token), usuarioId, '2099-01-01T00:00:00.000Z', '2026-11-18T12:00:00.000Z').run();
  return `jose_sessao=${token}`;
}

/** Dois usuários com todas as tabelas preenchidas: "a" (o dono dos dados) e "b" (quem tenta alcançá-los). */
async function doisUsuarios(extra: Parameters<typeof criarAppTeste>[0] = {}) {
  const t = criarAppTeste(extra);
  const a = await semearUsuario(t.env.DB, 'a', 'a@x.com');
  const b = await semearUsuario(t.env.DB, 'b', 'b@x.com');
  const cookieA = await cookieDe(t, a.usuarioId, 'token-do-a');
  const cookieB = await cookieDe(t, b.usuarioId, 'token-do-b');
  return { t, a, b, cookieA, cookieB };
}

interface RotaId {
  rotulo: string;
  metodo: string;
  /** Rota registrada no Hono (com :id), usada para conferir que nenhuma rota /:id ficou fora desta lista. */
  padrao: string;
  caminho: (a: Semeado) => string;
  corpo?: unknown;
}
const ROTAS_ID: RotaId[] = [
  { rotulo: 'abrir conversa', metodo: 'GET', padrao: '/api/conversas/:id', caminho: (a) => `/api/conversas/${a.conversaId}` },
  { rotulo: 'apagar conversa', metodo: 'DELETE', padrao: '/api/conversas/:id', caminho: (a) => `/api/conversas/${a.conversaId}` },
  { rotulo: 'enviar mensagem', metodo: 'POST', padrao: '/api/conversas/:id/mensagens', caminho: (a) => `/api/conversas/${a.conversaId}/mensagens`, corpo: { id: 'id-novo-1', texto: 'invasor', origem: 'texto' } },
  { rotulo: 'lote de sugestões', metodo: 'POST', padrao: '/api/conversas/:id/sugestoes/lote', caminho: (a) => `/api/conversas/${a.conversaBvId}/sugestoes/lote`, corpo: { salvar: [], descartar: [] } },
  { rotulo: 'apagar mensagem', metodo: 'DELETE', padrao: '/api/mensagens/:id', caminho: (a) => `/api/mensagens/${a.mensagemId}` },
  { rotulo: 'apagar mensagem com resposta', metodo: 'DELETE', padrao: '/api/mensagens/:id', caminho: (a) => `/api/mensagens/${a.mensagemId}?com_resposta=1` },
  { rotulo: 'salvar sugestão', metodo: 'POST', padrao: '/api/sugestoes/:id/salvar', caminho: (a) => `/api/sugestoes/${a.sugestaoId}/salvar`, corpo: {} },
  { rotulo: 'descartar sugestão', metodo: 'POST', padrao: '/api/sugestoes/:id/descartar', caminho: (a) => `/api/sugestoes/${a.sugestaoId}/descartar` },
  { rotulo: 'editar tarefa', metodo: 'PATCH', padrao: '/api/tarefas/:id', caminho: (a) => `/api/tarefas/${a.tarefaId}`, corpo: { titulo: 'invadida', concluida: true } },
  { rotulo: 'apagar tarefa', metodo: 'DELETE', padrao: '/api/tarefas/:id', caminho: (a) => `/api/tarefas/${a.tarefaId}` },
  { rotulo: 'editar meta', metodo: 'PATCH', padrao: '/api/metas/:id', caminho: (a) => `/api/metas/${a.metaId}`, corpo: { titulo: 'invadida', status: 'concluida' } },
  { rotulo: 'apagar meta', metodo: 'DELETE', padrao: '/api/metas/:id', caminho: (a) => `/api/metas/${a.metaId}` },
  { rotulo: 'editar memória', metodo: 'PATCH', padrao: '/api/memorias/:id', caminho: (a) => `/api/memorias/${a.memoriaId}`, corpo: { texto: 'invadida' } },
  { rotulo: 'apagar memória', metodo: 'DELETE', padrao: '/api/memorias/:id', caminho: (a) => `/api/memorias/${a.memoriaId}` },
];

const pedir = (t: T, r: RotaId, caminho: string, cookie: string) =>
  t.chamar(caminho, { method: r.metodo, headers: { cookie, origin: URL_TESTE, ...JSON_H }, body: r.corpo === undefined ? undefined : JSON.stringify(r.corpo) });

describe('isolamento entre usuários (404 em toda rota /:id)', () => {
  it('a lista de rotas do teste cobre TODAS as rotas /:id registradas no app', async () => {
    const { t } = await doisUsuarios();
    const registradas = new Set(t.app.routes.filter((r) => r.path.includes(':id') && r.method !== 'ALL').map((r) => `${r.method} ${r.path}`));
    const cobertas = new Set(ROTAS_ID.map((r) => `${r.metodo} ${r.padrao}`));
    expect([...registradas].filter((x) => !cobertas.has(x)), 'rota /:id sem teste de isolamento').toEqual([]);
    expect([...cobertas].filter((x) => !registradas.has(x)), 'rota do teste que não existe mais').toEqual([]);
  });

  it.each(ROTAS_ID.map((r) => [r.rotulo, r] as const))('%s: o outro usuário recebe 404 igual ao de um id inexistente e nada muda', async (_n, rota) => {
    const { t, a, b, cookieB } = await doisUsuarios({ ia: criarIaFalsa([{}]).ia });
    const antesA = await contarTabelas(t.env.DB, { usuarioId: a.usuarioId });
    const snapshot = JSON.stringify((await t.env.DB.prepare('SELECT * FROM tarefas, metas, memorias WHERE tarefas.usuario_id = ? AND metas.usuario_id = ? AND memorias.usuario_id = ?').bind(a.usuarioId, a.usuarioId, a.usuarioId).all()).results);

    const r = await pedir(t, rota, rota.caminho(a), cookieB);
    expect(r.status).toBe(404);
    const corpoRoubado = await r.text();
    // Mesmo corpo que um id que não existe em lugar nenhum: a resposta não revela que o item existe.
    const fantasma = { ...a, conversaId: 'nao-existe', conversaBvId: 'nao-existe', mensagemId: 'nao-existe', sugestaoId: 'nao-existe', tarefaId: 'nao-existe', metaId: 'nao-existe', memoriaId: 'nao-existe' };
    const rf = await pedir(t, rota, rota.caminho(fantasma), cookieB);
    expect(rf.status).toBe(404);
    expect(await rf.text()).toBe(corpoRoubado);
    expect(corpoRoubado).not.toMatch(/segredo de a|Conversa a|Tarefa a|Meta a|Memória a/);

    expect(await contarTabelas(t.env.DB, { usuarioId: a.usuarioId })).toEqual(antesA);
    expect(JSON.stringify((await t.env.DB.prepare('SELECT * FROM tarefas, metas, memorias WHERE tarefas.usuario_id = ? AND metas.usuario_id = ? AND memorias.usuario_id = ?').bind(a.usuarioId, a.usuarioId, a.usuarioId).all()).results)).toBe(snapshot);
    // E o próprio B segue intacto.
    expect((await contarTabelas(t.env.DB, { usuarioId: b.usuarioId })).mensagens).toBe(2);
  });

  it('as listas devolvem só os dados de quem pergunta', async () => {
    const { t, a, cookieB } = await doisUsuarios();
    for (const caminho of ['/api/conversas', '/api/tarefas', '/api/metas', '/api/memorias', '/api/conversas/hoje', '/api/eu']) {
      const r = await t.chamar(caminho, { headers: { cookie: cookieB } });
      const texto = await r.text();
      expect(r.status, caminho).toBeLessThan(500);
      expect(texto, caminho).not.toContain(a.usuarioId);
      expect(texto, caminho).not.toMatch(/Conversa a|Tarefa a|Meta a|Memória a|segredo de a/);
    }
  });

  it('um id de mensagem de outro usuário não pode ser reutilizado para ler ou apagar nada (409 sem conteúdo)', async () => {
    const { t, a, b, cookieB } = await doisUsuarios({ ia: criarIaFalsa([{}]).ia });
    const r = await t.chamar(`/api/conversas/${b.conversaId}/mensagens`, { method: 'POST', headers: { cookie: cookieB, origin: URL_TESTE, ...JSON_H }, body: JSON.stringify({ id: a.mensagemId, texto: 'oi', origem: 'texto' }) });
    expect(r.status).toBe(409);
    expect(await r.text()).not.toContain('segredo de a');
    expect((await contarTabelas(t.env.DB, { usuarioId: a.usuarioId })).mensagens).toBe(2);
  });

  it('o usuario_id nunca vem do corpo: criar item com usuario_id alheio grava no dono da sessão', async () => {
    const { t, a, b, cookieB } = await doisUsuarios();
    const r = await t.chamar('/api/tarefas', { method: 'POST', headers: { cookie: cookieB, origin: URL_TESTE, ...JSON_H }, body: JSON.stringify({ titulo: 'x', area: 'casa', usuario_id: a.usuarioId }) });
    expect(r.status).toBe(201);
    const { id } = (await r.json()) as { id: string };
    expect((await t.env.DB.prepare('SELECT usuario_id FROM tarefas WHERE id = ?').bind(id).first<{ usuario_id: string }>())?.usuario_id).toBe(b.usuarioId);
  });
});

describe('Origin (CSRF) e sessão em todas as rotas de escrita', () => {
  const escritas = (t: T) =>
    t.app.routes
      .filter((r) => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method) && (r.path.startsWith('/api/') || r.path.startsWith('/auth/')))
      .map((r) => ({ metodo: r.method, caminho: r.path.replace(/:id/g, 'x') }));

  it('há rotas de escrita para conferir (e o /api/eu DELETE é uma delas)', () => {
    const t = criarAppTeste();
    const lista = escritas(t).map((e) => `${e.metodo} ${e.caminho}`);
    expect(lista.length).toBeGreaterThanOrEqual(15);
    expect(lista).toContain('DELETE /api/eu');
    expect(lista).toContain('POST /api/voz');
  });

  it('Origin ausente, de outro site, de subdomínio parecido ou com outro esquema → 403, mesmo com sessão válida', async () => {
    const { t, cookieA } = await doisUsuarios();
    for (const e of escritas(t)) {
      for (const origin of [null, 'https://evil.example', `${URL_TESTE}.evil.com`, 'http://jose.exemplo.dev', 'null']) {
        const r = await t.chamar(e.caminho, { method: e.metodo, headers: { cookie: cookieA, ...(origin ? { origin } : {}), ...JSON_H }, body: '{}' });
        expect(r.status, `${e.metodo} ${e.caminho} com Origin ${origin}`).toBe(403);
      }
    }
  });

  it('com Origin certo e sem sessão, toda rota /api (leitura ou escrita) responde 401', async () => {
    const { t } = await doisUsuarios();
    const todas = t.app.routes.filter((r) => r.path.startsWith('/api/') && r.method !== 'ALL');
    expect(todas.length).toBeGreaterThanOrEqual(25);
    for (const r of todas) {
      const resp = await t.chamar(r.path.replace(/:id/g, 'x'), { method: r.method, headers: { origin: URL_TESTE, ...JSON_H }, body: r.method === 'GET' ? undefined : '{}' });
      expect(resp.status, `${r.method} ${r.path}`).toBe(401);
    }
  });

  it('cookie de sessão inventado ou expirado → 401', async () => {
    const { t } = await doisUsuarios({ agora: () => new Date('2100-01-01T00:00:00Z') });
    expect((await t.chamar('/api/eu', { headers: { cookie: 'jose_sessao=inventado' } })).status).toBe(401);
    expect((await t.chamar('/api/eu', { headers: { cookie: 'jose_sessao=token-do-a' } })).status).toBe(401); // expirou em 2099
  });
});

describe('cabeçalhos de segurança', () => {
  it('toda resposta de /api e /auth (sucesso, erro 401/403/404 e SSE) não é guardada em cache e traz nosniff, no-referrer e DENY', async () => {
    const { t, cookieA, a } = await doisUsuarios({ ia: criarIaFalsa([{}]).ia });
    const h = { cookie: cookieA, origin: URL_TESTE, ...JSON_H };
    const respostas = [
      await t.chamar('/api/eu', { headers: { cookie: cookieA } }), // 200
      await t.chamar('/api/eu'), // 401
      await t.chamar('/api/tarefas', { method: 'POST', headers: { cookie: cookieA, origin: 'https://evil.example' }, body: '{}' }), // 403
      await t.chamar('/api/conversas/nao-existe', { headers: { cookie: cookieA } }), // 404
      await t.chamar(`/api/conversas/${a.conversaId}/mensagens`, { method: 'POST', headers: h, body: JSON.stringify({ id: 'sse-1', texto: 'oi', origem: 'texto' }) }), // SSE
      await t.chamar('/auth/google'), // redirect
    ];
    for (const r of respostas) {
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('referrer-policy')).toBe('no-referrer');
      expect(r.headers.get('x-frame-options')).toBe('DENY');
    }
    expect(respostas[4]!.headers.get('content-type')).toContain('text/event-stream');
  });
});

describe('cookies', () => {
  const atributos = (setCookie: string) => setCookie.split(';').map((p) => p.trim().toLowerCase());

  it('sessão: HttpOnly, Secure, SameSite=Lax, Path=/ e validade de 30 dias; o banco guarda só o hash do token', async () => {
    const t = criarAppTeste();
    const { retorno, cookie } = await entrar(t);
    const sc = retorno.headers.getSetCookie().find((c) => c.startsWith('jose_sessao='))!;
    const at = atributos(sc);
    expect(at).toContain('httponly');
    expect(at).toContain('secure');
    expect(at).toContain('samesite=lax');
    expect(at).toContain('path=/');
    expect(at).toContain(`max-age=${30 * 24 * 3600}`);
    const token = cookie.split('=')[1]!;
    const ids = (await t.env.DB.prepare('SELECT id FROM sessoes').all<{ id: string }>()).results.map((s) => s.id);
    expect(ids).toEqual([await sha256Hex(token)]);
    expect(ids).not.toContain(token);
  });

  it('cookie temporário do OAuth: HttpOnly, Secure, SameSite=Lax e assinado (sem o segredo da sessão em claro)', async () => {
    const t = criarAppTeste();
    const r = await t.chamar('/auth/google');
    const sc = r.headers.getSetCookie().find((c) => c.startsWith('jose_oauth='))!;
    const at = atributos(sc);
    for (const a of ['httponly', 'secure', 'samesite=lax', 'path=/']) expect(at).toContain(a);
    expect(sc).not.toContain('segredo-de-sessao-para-testes');
  });

  it('sair e apagar tudo limpam o cookie de sessão (valor vazio e expirado)', async () => {
    const t = criarAppTeste();
    const { cookie } = await entrar(t);
    const r = await t.chamar('/auth/sair', { method: 'POST', headers: { cookie, origin: URL_TESTE } });
    const sc = r.headers.getSetCookie().find((c) => c.startsWith('jose_sessao='))!;
    expect(sc).toMatch(/^jose_sessao=;/);
    expect(atributos(sc).some((x) => x.startsWith('max-age=0') || x.startsWith('expires='))).toBe(true);
  });

  it('em http (desenvolvimento local) o Secure é desligado, em https nunca', async () => {
    const t = criarAppTeste({ env: { URL_BASE: 'http://localhost:8787' } });
    const r = await t.app.request('http://localhost:8787/auth/google', {}, t.env);
    expect(atributos(r.headers.getSetCookie()[0]!)).not.toContain('secure');
  });
});

describe('logs sem conteúdo nem segredos', () => {
  afterEach(() => vi.restoreAllMocks());

  it('nenhum log traz texto de mensagem, resposta, memória, transcrição, token de sessão ou segredos', async () => {
    const linhas: string[] = [];
    const guardar = (...args: unknown[]) => linhas.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a, (_k, v) => (v instanceof Error ? { name: v.name, message: v.message } : v)))).join(' '));
    for (const m of ['log', 'warn', 'error', 'info', 'debug'] as const) vi.spyOn(console, m).mockImplementation(guardar);

    const SEGREDOS = { chaveIa: 'chave-da-ia-falsa-para-teste', ...{} };
    const roteiro = (n: number) =>
      n === 0
        ? { partes: ['RESPOSTA-SECRETA-456'], sugestoes: [{ nome: 'sugerir_memoria', entrada: { texto: 'MEMORIA-SECRETA-789', area: 'saude' } }, { nome: 'sugerir_tarefa', entrada: { titulo: 'TAREFA-INVALIDA-321', area: 'area-que-nao-existe' } }] }
        : { partes: ['RESPOSTA-PARCIAL-654'], erro: new ErroIA('indisponivel', 'detalhe com MENSAGEM-SECRETA-987') };
    const falsa = criarIaFalsa((n) => roteiro(n));
    const transcricoes = ['TRANSCRICAO-SECRETA-000'];
    const t = criarAppTeste({
      ia: falsa.ia,
      env: { ANTHROPIC_API_KEY: SEGREDOS.chaveIa },
      transcritor: { transcrever: async () => { if (transcricoes.length) return transcricoes.pop()!; throw new Error('falha com TRANSCRICAO-SECRETA-000'); } },
    });
    const { cookie } = await entrar(t);
    const h = { cookie, origin: URL_TESTE, ...JSON_H };
    const conv = ((await (await t.chamar('/api/conversas', { method: 'POST', headers: h, body: '{"tipo":"normal"}' })).json()) as { id: string }).id;
    const enviar = (id: string, texto: string, conversa = conv) => t.chamar(`/api/conversas/${conversa}/mensagens`, { method: 'POST', headers: h, body: JSON.stringify({ id, texto, origem: 'texto' }) });

    await lerEventos(await enviar('m-1', 'MENSAGEM-SECRETA-123 com minha saúde')); // sucesso, sugestão válida e inválida
    await (await enviar('m-2', 'MENSAGEM-SECRETA-987')).text(); // falha da IA no meio do fluxo
    // Boas-vindas (perguntas fixas, sem IA).
    const bv = ((await (await t.chamar('/api/conversas', { method: 'POST', headers: h, body: '{"tipo":"boas_vindas"}' })).json()) as { id: string }).id;
    await (await enviar('b-1', 'RESPOSTA-BV-SECRETA-555', bv)).text();
    // Voz: com sucesso e com falha.
    const voz = () => { const f = new FormData(); f.set('audio', new File([new Uint8Array(500).fill(1)], 'a.m4a', { type: 'audio/mp4' })); return t.chamar('/api/voz', { method: 'POST', headers: { cookie, origin: URL_TESTE }, body: f }); };
    expect((await voz()).status).toBe(200);
    expect((await voz()).status).toBe(500);
    // Erro interno (a transação de apagar tudo falha) e conta apagada.
    await t.env.DB.exec("CREATE TRIGGER barra BEFORE DELETE ON usuarios BEGIN SELECT RAISE(ABORT, 'MENSAGEM-SECRETA-123'); END");
    const falha = await t.chamar('/api/eu', { method: 'DELETE', headers: h, body: '{"confirmacao":"APAGAR"}' });
    expect(falha.status).toBe(500);
    expect(await falha.text()).not.toContain('MENSAGEM-SECRETA');
    await t.env.DB.exec('DROP TRIGGER barra');
    expect((await t.chamar('/api/eu', { method: 'DELETE', headers: h, body: '{"confirmacao":"APAGAR"}' })).status).toBe(204);
    // Login negado e falho (e-mail do outro aparece?).
    const negado = criarAppTeste({ perfil: { email: 'intruso@x.com', emailVerificado: true, nome: 'Intruso', fotoUrl: null } });
    await entrar(negado);

    expect(linhas.length, 'o teste deveria ter gerado logs para conferir').toBeGreaterThan(3);
    const tudo = linhas.join('\n');
    for (const proibido of [
      'MENSAGEM-SECRETA', 'RESPOSTA-SECRETA', 'RESPOSTA-PARCIAL', 'MEMORIA-SECRETA', 'TAREFA-INVALIDA', 'TRANSCRICAO-SECRETA', 'RESPOSTA-BV-SECRETA', 'minha saúde',
      SEGREDOS.chaveIa, 'segredo-teste', 'segredo-de-sessao-para-testes', cookie.split('=')[1]!, 'sk-ant', 'GOCSPX', 'intruso@x.com',
    ]) {
      expect(tudo, `log vazou: ${proibido}`).not.toContain(proibido);
    }
  });
});
