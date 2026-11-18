import type { Page } from '@playwright/test';

export const EU = { nome: 'Marco', email: 'marco@gmail.com', foto_url: null, boas_vindas_concluida: true };

/** Simula a API: logado (200) ou sessão expirada (401). */
export async function simularApi(page: Page, logado = true) {
  // Por padrão a API de conversas responde "nenhuma conversa hoje" (os testes do Chat usam simularChat).
  await page.route((url) => url.pathname === '/api/conversas/hoje', (rota) => rota.fulfill({ status: 200, json: null }));
  await page.route('**/api/eu', (rota) =>
    logado
      ? rota.fulfill({ status: 200, json: EU })
      : rota.fulfill({ status: 401, json: { erro: { codigo: 'nao_autenticado', mensagem: 'Entre de novo' } } }),
  );
}

// ---- API de conversas simulada (SSE) para os testes do Chat ----
export type Plano = 'ok' | 'erro-ia' | 'cortada' | 'limite' | '401';

interface MsgFalsa { id: string; autor: 'marco' | 'jose'; texto: string; origem: 'texto' | 'voz'; modelo: string | null; criada_em: string }
/** Conteúdo de um cartão: memória ({texto, area}) ou tarefa/meta ({titulo, area, prazo?}, com `tipo`). */
export type CartaoFalso = { texto: string; area: string } | { tipo: 'tarefa' | 'meta'; titulo: string; area: string; prazo?: string | null };
export interface SugestaoFalsa {
  id: string; mensagem_id: string; tipo: 'memoria' | 'tarefa' | 'meta'; conteudo: Record<string, unknown>; status: 'pendente' | 'salva' | 'descartada'; item_id: string | null;
}
export interface ConversaFalsa {
  id: string; titulo: string | null; tipo: 'normal'; modo: 'padrao' | 'decidir'; criada_em: string; atualizada_em: string; mensagens: MsgFalsa[];
  sugestoes?: SugestaoFalsa[];
}

export interface ChatFalso {
  conversas: ConversaFalsa[];
  /** Conversa devolvida por GET /api/conversas/hoje (null = nenhuma). */
  hoje: string | null;
  /** Resultado de cada POST de mensagem, na ordem (padrão: ok). */
  planos: Plano[];
  /** Atraso (ms) antes de responder a um POST de mensagem. */
  atrasoMs: number;
  /** Atraso (ms) antes de responder a GET /api/conversas/hoje. */
  atrasoHojeMs: number;
  /** Atraso (ms) antes de responder a GET /api/conversas (lista do histórico). */
  atrasoListaMs: number;
  /** Faz GET /api/conversas falhar (500). */
  listaFalha: boolean;
  postsMensagem: Array<{ conversa: string; id: string; texto: string; origem: 'texto' | 'voz' }>;
  postsConversa: Array<Record<string, unknown>>;
  deletes: string[];
  /** Mensagens apagadas (DELETE /api/mensagens/:id), na ordem. */
  deletesMensagem: Array<{ id: string; comResposta: boolean }>;
  /** O DELETE de mensagem responde sucesso mas NÃO apaga nada (cliente e servidor divergem). */
  deleteIgnorado: boolean;
  /** Leituras de GET /api/conversas/:id (id), na ordem. */
  lidas: string[];
  /** Cartões que a próxima resposta do José sugere (🧠 memória, 📌 tarefa, 🎯 meta). */
  sugerir: CartaoFalso[];
  /** Quantas chamadas de salvar devem falhar (500) antes de funcionar. */
  salvarFalhas: number;
  /** Atraso (ms) antes de responder salvar. */
  atrasoSalvarMs: number;
  /** Chamadas de salvar/descartar recebidas, na ordem. */
  salvos: Array<{ id: string; conteudo?: Record<string, unknown> }>;
  descartados: string[];
}

const iso = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

/** `mensagens`: [autor, texto, minutosAtras?]; sem o 3º valor a mensagem tem a hora da conversa. */
export function novaConversa(id: string, titulo: string | null, minutosAtras = 0, modo: 'padrao' | 'decidir' = 'padrao', mensagens: Array<[string, string, number?]> = []): ConversaFalsa {
  return {
    id, titulo, tipo: 'normal', modo, criada_em: iso(minutosAtras), atualizada_em: iso(minutosAtras),
    mensagens: mensagens.map(([autor, texto, minutos], i) => ({ id: `${id}-m${i}`, autor: autor as 'marco' | 'jose', texto, origem: 'texto', modelo: autor === 'jose' ? 'claude-haiku-5-5' : null, criada_em: iso(minutos ?? minutosAtras) })),
  };
}

const sse = (eventos: Array<[string, unknown]>) => eventos.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
const resumo = (c: ConversaFalsa) => ({ id: c.id, titulo: c.titulo, tipo: c.tipo, modo: c.modo, atualizada_em: c.atualizada_em });
const completa = (c: ConversaFalsa) => ({ conversa: { id: c.id, titulo: c.titulo, tipo: c.tipo, modo: c.modo, criada_em: c.criada_em, atualizada_em: c.atualizada_em }, mensagens: c.mensagens, sugestoes: c.sugestoes ?? [] });

export async function simularChat(page: Page, inicial: Partial<ChatFalso> = {}): Promise<ChatFalso> {
  const f: ChatFalso = { conversas: [], hoje: null, planos: [], atrasoMs: 0, atrasoHojeMs: 0, atrasoListaMs: 0, listaFalha: false, postsMensagem: [], postsConversa: [], deletes: [], deletesMensagem: [], deleteIgnorado: false, lidas: [], sugerir: [], salvarFalhas: 0, atrasoSalvarMs: 0, salvos: [], descartados: [], ...inicial };
  let proximo = 1;
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Salvar e descartar sugestões (a lista de memórias salvas vai para o simulador de memórias, se houver).
  let proximaMemoria = 1;
  await page.route((url) => url.pathname.startsWith('/api/sugestoes/'), async (rota) => {
    const [, , id, acao] = new URL(rota.request().url()).pathname.split('/').filter(Boolean);
    const sug = f.conversas.flatMap((c) => c.sugestoes ?? []).find((x) => x.id === id);
    if (!sug) return rota.fulfill({ status: 404, json: { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } } });
    if (acao === 'descartar') {
      f.descartados.push(sug.id);
      if (sug.status !== 'pendente') return rota.fulfill({ status: 409, json: { erro: { codigo: 'sugestao_ja_tratada', mensagem: 'x' } } });
      sug.status = 'descartada';
      return rota.fulfill({ status: 204 });
    }
    const corpo = (rota.request().postDataJSON() as { conteudo?: Record<string, unknown> } | null) ?? {};
    f.salvos.push({ id: sug.id, conteudo: corpo.conteudo });
    if (f.atrasoSalvarMs) await espera(f.atrasoSalvarMs);
    if (f.salvarFalhas > 0) {
      f.salvarFalhas--;
      return rota.fulfill({ status: 500, json: { erro: { codigo: 'erro_interno', mensagem: 'x' } } });
    }
    if (sug.status !== 'pendente') return rota.fulfill({ status: 409, json: { erro: { codigo: 'sugestao_ja_tratada', mensagem: 'x' } } });
    sug.status = 'salva';
    if (corpo.conteudo) sug.conteudo = corpo.conteudo;
    sug.item_id = `mem${proximaMemoria++}`;
    const base = { id: sug.item_id, area: sug.conteudo.area, origem: 'chat', criada_em: new Date().toISOString() };
    const item = sug.tipo === 'memoria' ? { ...base, texto: sug.conteudo.texto, atualizada_em: null } : { ...base, titulo: sug.conteudo.titulo, prazo: sug.conteudo.prazo ?? null };
    return rota.fulfill({ status: 200, json: { item } });
  });

  // Apagar mensagem: DELETE /api/mensagens/:id[?com_resposta=1] (404 se não existe, como o servidor).
  await page.route((url) => url.pathname.startsWith('/api/mensagens/'), async (rota) => {
    const url = new URL(rota.request().url());
    const id = decodeURIComponent(url.pathname.split('/').filter(Boolean)[2] ?? '');
    const comResposta = url.searchParams.get('com_resposta') === '1';
    const conversa = f.conversas.find((c) => c.mensagens.some((m) => m.id === id));
    if (!conversa) return rota.fulfill({ status: 404, json: { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } } });
    f.deletesMensagem.push({ id, comResposta });
    if (f.deleteIgnorado) return rota.fulfill({ status: 204 });
    const i = conversa.mensagens.findIndex((m) => m.id === id);
    const seguinte = conversa.mensagens[i + 1];
    const apagar = new Set([id, ...(comResposta && seguinte?.autor === 'jose' ? [seguinte.id] : [])]);
    conversa.mensagens = conversa.mensagens.filter((m) => !apagar.has(m.id));
    conversa.sugestoes = (conversa.sugestoes ?? []).filter((s) => !apagar.has(s.mensagem_id));
    // Como o servidor: conversa `normal` que ficou sem mensagens também é apagada (200 com conversa_apagada).
    if (conversa.mensagens.length === 0 && conversa.tipo === 'normal') {
      f.conversas = f.conversas.filter((c) => c !== conversa);
      return rota.fulfill({ status: 200, json: { conversa_apagada: true } });
    }
    return rota.fulfill({ status: 204 });
  });

  // (predicado, e não glob: '**/api/conversas**' também casaria o módulo app/src/api/conversas.ts do Vite)
  await page.route((url) => url.pathname.startsWith('/api/conversas'), async (rota) => {
    const req = rota.request();
    const caminho = new URL(req.url()).pathname;
    const metodo = req.method();
    const partes = caminho.split('/').filter(Boolean); // api, conversas, [id|hoje], [mensagens]
    const json = (status: number, corpo: unknown) => rota.fulfill({ status, json: corpo });

    if (partes.length === 2) {
      if (metodo === 'GET') {
        if (f.atrasoListaMs) await espera(f.atrasoListaMs);
        if (f.listaFalha) return json(500, { erro: { codigo: 'erro_interno', mensagem: 'x' } });
        return json(200, [...f.conversas].sort((a, b) => b.atualizada_em.localeCompare(a.atualizada_em)).map(resumo));
      }
      const corpo = req.postDataJSON() as { tipo: 'normal'; modo?: 'padrao' | 'decidir' };
      f.postsConversa.push(corpo);
      const c = novaConversa(`c${proximo++}`, null, 0, corpo.modo ?? 'padrao');
      f.conversas.push(c);
      return json(201, { id: c.id });
    }
    if (partes[2] === 'hoje') {
      if (f.atrasoHojeMs) await espera(f.atrasoHojeMs);
      const c = f.conversas.find((x) => x.id === f.hoje);
      return json(200, c ? completa(c) : null);
    }
    const conversa = f.conversas.find((x) => x.id === partes[2]);
    if (partes.length === 3) {
      if (metodo === 'DELETE') {
        f.deletes.push(partes[2]!);
        f.conversas = f.conversas.filter((x) => x.id !== partes[2]);
        return rota.fulfill({ status: 204 });
      }
      if (conversa) f.lidas.push(conversa.id);
      return conversa ? json(200, completa(conversa)) : json(404, { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } });
    }
    // POST /api/conversas/:id/mensagens
    if (!conversa) return json(404, { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } });
    const msg = req.postDataJSON() as { id: string; texto: string; origem: 'texto' | 'voz' };
    f.postsMensagem.push({ conversa: conversa.id, id: msg.id, texto: msg.texto, origem: msg.origem });
    const plano = f.planos.shift() ?? 'ok';
    if (f.atrasoMs && (plano === '401' || plano === 'limite')) await espera(f.atrasoMs);
    if (plano === '401') return json(401, { erro: { codigo: 'nao_autenticado', mensagem: 'Entre de novo.' } });
    if (plano === 'limite') return json(429, { erro: { codigo: 'limite_diario', mensagem: 'Limite de hoje atingido, volta amanhã.' } });
    const existente = conversa.mensagens.findIndex((m) => m.id === msg.id);
    // Como o servidor: a mensagem do Marco é gravada ANTES de a IA responder; o atraso simula a IA pensando.
    if (existente < 0) conversa.mensagens.push({ id: msg.id, autor: 'marco', texto: msg.texto, origem: msg.origem, modelo: null, criada_em: iso(0) });
    if (f.atrasoMs) await espera(f.atrasoMs);
    const corpoSse = (eventos: Array<[string, unknown]>) => rota.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(eventos) });
    if (plano === 'erro-ia') return corpoSse([['erro', { codigo: 'ia_indisponivel', mensagem: 'O José não conseguiu responder agora.' }]]);
    if (plano === 'cortada') return corpoSse([['texto', { delta: 'Resposta pela metade' }]]);
    const resposta: MsgFalsa = { id: `${msg.id}-resp`, autor: 'jose', texto: 'Resposta do José. Próximo passo: abrir o arquivo.', origem: 'texto', modelo: 'claude-haiku-5-5', criada_em: iso(0) };
    const jaTinha = conversa.mensagens.some((m) => m.id === resposta.id);
    if (!jaTinha) conversa.mensagens.push(resposta);
    conversa.atualizada_em = iso(0);
    const titulo = conversa.titulo ? undefined : 'Título de teste';
    if (titulo) conversa.titulo = titulo;
    const novas = f.sugerir.splice(0).map((c, i): SugestaoFalsa => {
      const { tipo, ...conteudo } = 'tipo' in c ? c : { tipo: 'memoria' as const, ...c };
      return { id: `sg-${resposta.id}-${i}`, mensagem_id: resposta.id, tipo, conteudo, status: 'pendente', item_id: null };
    });
    conversa.sugestoes = [...(conversa.sugestoes ?? []), ...novas];
    // Reenvio de mensagem já respondida: o servidor real repete as sugestões gravadas, com o status atual.
    const enviadas = jaTinha ? (conversa.sugestoes ?? []).filter((x) => x.mensagem_id === resposta.id) : novas;
    return corpoSse([
      ['texto', { delta: 'Resposta do José. ' }], ['texto', { delta: 'Próximo passo: abrir o arquivo.' }],
      ...enviadas.map((n): [string, unknown] => ['sugestao', { id: n.id, tipo: n.tipo, conteudo: n.conteudo, status: n.status, item_id: n.item_id }]),
      ['fim', titulo ? { mensagem_id: resposta.id, titulo } : { mensagem_id: resposta.id }],
    ]);
  });
  return f;
}

// ---- API de memórias simulada (José sabe) ----
export interface MemoriaFalsa { id: string; texto: string; area: string; origem: 'boas_vindas' | 'chat' | 'manual'; criada_em: string; atualizada_em: string | null }

export interface MemoriasFalsas {
  memorias: MemoriaFalsa[];
  /** GET /api/memorias responde 500. */
  listaFalha: boolean;
  /** Atraso (ms) antes de responder ao GET (para ver o esqueleto). */
  atrasoMs: number;
  /** Quantas escritas (POST/PATCH) devem falhar com 500 antes de funcionar. */
  escritaFalhas: number;
  posts: Array<{ texto: string; area: string }>;
  patches: Array<{ id: string; campos: Record<string, unknown> }>;
  deletes: string[];
}

export const memoriaFalsa = (id: string, texto: string, area: string, diasAtras = 1): MemoriaFalsa => ({
  id, texto, area, origem: 'manual', criada_em: new Date(Date.now() - diasAtras * 86_400_000).toISOString(), atualizada_em: null,
});

export async function simularMemorias(page: Page, inicial: Partial<MemoriasFalsas> = {}): Promise<MemoriasFalsas> {
  const f: MemoriasFalsas = { memorias: [], listaFalha: false, atrasoMs: 0, escritaFalhas: 0, posts: [], patches: [], deletes: [], ...inicial };
  let proximo = 1;
  await page.route((url) => url.pathname.startsWith('/api/memorias'), async (rota) => {
    const req = rota.request();
    const partes = new URL(req.url()).pathname.split('/').filter(Boolean); // api, memorias, [id]
    const json = (status: number, corpo: unknown) => rota.fulfill({ status, json: corpo });
    const erro500 = () => json(500, { erro: { codigo: 'erro_interno', mensagem: 'x' } });
    const metodo = req.method();
    if (metodo === 'GET') {
      if (f.atrasoMs) await new Promise((r) => setTimeout(r, f.atrasoMs));
      if (f.listaFalha) return erro500();
      return json(200, [...f.memorias].sort((a, b) => b.criada_em.localeCompare(a.criada_em)));
    }
    if (metodo === 'POST') {
      const corpo = req.postDataJSON() as { texto: string; area: string };
      f.posts.push(corpo);
      if (f.escritaFalhas > 0) { f.escritaFalhas--; return erro500(); }
      const m: MemoriaFalsa = { id: `novo${proximo++}`, texto: corpo.texto.trim(), area: corpo.area, origem: 'manual', criada_em: new Date().toISOString(), atualizada_em: null };
      f.memorias.push(m);
      return json(201, m);
    }
    const m = f.memorias.find((x) => x.id === partes[2]);
    if (!m) return json(404, { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } });
    if (metodo === 'PATCH') {
      const campos = req.postDataJSON() as { texto?: string; area?: string };
      f.patches.push({ id: m.id, campos });
      if (f.escritaFalhas > 0) { f.escritaFalhas--; return erro500(); }
      Object.assign(m, { ...(campos.texto !== undefined ? { texto: campos.texto.trim() } : {}), ...(campos.area ? { area: campos.area } : {}), atualizada_em: new Date().toISOString() });
      return json(200, m);
    }
    f.deletes.push(m.id);
    f.memorias = f.memorias.filter((x) => x.id !== m.id);
    return rota.fulfill({ status: 204 });
  });
  return f;
}

// ---- API de tarefas e metas simulada (aba Tarefas) ----
export interface TarefaFalsa {
  id: string; titulo: string; area: string; prazo: string | null; concluida: boolean; concluida_em: string | null; origem: 'chat' | 'manual' | 'boas_vindas'; criada_em: string;
}
export interface MetaFalsa {
  id: string; titulo: string; area: string; prazo: string | null; status: 'ativa' | 'concluida'; concluida_em: string | null; origem: 'chat' | 'manual' | 'boas_vindas'; criada_em: string;
}

export interface TarefasFalsas {
  tarefas: TarefaFalsa[];
  metas: MetaFalsa[];
  /** GET de tarefas/metas responde 500. */
  listaFalha: boolean;
  /** Atraso (ms) antes de responder ao GET (para ver o esqueleto). */
  atrasoMs: number;
  /** Quantas escritas (POST/PATCH) devem falhar com 500 antes de funcionar. */
  escritaFalhas: number;
  /** Chamadas recebidas, na ordem: { rota: 'tarefas' | 'metas', metodo, id?, corpo? }. */
  chamadas: Array<{ rota: 'tarefas' | 'metas'; metodo: string; id?: string; corpo?: Record<string, unknown> }>;
}

let sequenciaFalsa = 0;
/** Prazo = hoje (no fuso de São Paulo) + `dias`. Com `page.clock.setFixedTime` o "hoje" do app e o daqui são o mesmo dia. */
export function diaRelativo(dias: number, base: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(base.getTime() + dias * 86_400_000));
}
export const tarefaFalsa = (titulo: string, extra: Partial<TarefaFalsa> = {}): TarefaFalsa => {
  const n = ++sequenciaFalsa;
  return { id: `t${n}`, titulo, area: 'trabalho', prazo: null, concluida: false, concluida_em: null, origem: 'manual', criada_em: new Date(Date.UTC(2026, 10, 1, 0, 0, n)).toISOString(), ...extra };
};
export const metaFalsa = (titulo: string, extra: Partial<MetaFalsa> = {}): MetaFalsa => {
  const n = ++sequenciaFalsa;
  return { id: `m${n}`, titulo, area: 'saude', prazo: null, status: 'ativa', concluida_em: null, origem: 'manual', criada_em: new Date(Date.UTC(2026, 10, 1, 0, 0, n)).toISOString(), ...extra };
};

export async function simularTarefas(page: Page, inicial: Partial<TarefasFalsas> = {}): Promise<TarefasFalsas> {
  const f: TarefasFalsas = { tarefas: [], metas: [], listaFalha: false, atrasoMs: 0, escritaFalhas: 0, chamadas: [], ...inicial };
  let proximo = 1000;
  for (const rotaNome of ['tarefas', 'metas'] as const) {
    await page.route((url) => url.pathname === `/api/${rotaNome}` || url.pathname.startsWith(`/api/${rotaNome}/`), async (rota) => {
      const req = rota.request();
      const partes = new URL(req.url()).pathname.split('/').filter(Boolean); // api, tarefas, [id]
      const json = (status: number, corpo: unknown) => rota.fulfill({ status, json: corpo });
      const erro500 = () => json(500, { erro: { codigo: 'erro_interno', mensagem: 'x' } });
      const metodo = req.method();
      const lista = (rotaNome === 'tarefas' ? f.tarefas : f.metas) as Array<TarefaFalsa & MetaFalsa>;
      if (metodo === 'GET') {
        f.chamadas.push({ rota: rotaNome, metodo });
        if (f.atrasoMs) await new Promise((r) => setTimeout(r, f.atrasoMs));
        if (f.listaFalha) return erro500();
        return json(200, lista);
      }
      const corpo = (req.postDataJSON() ?? undefined) as Record<string, unknown> | undefined;
      f.chamadas.push({ rota: rotaNome, metodo, id: partes[2], corpo });
      if (metodo !== 'DELETE' && f.escritaFalhas > 0) { f.escritaFalhas--; return erro500(); }
      if (metodo === 'POST') {
        const base = { id: `novo${proximo++}`, titulo: String(corpo!.titulo).trim(), area: String(corpo!.area), prazo: (corpo!.prazo as string | null | undefined) ?? null, origem: 'manual' as const, criada_em: new Date().toISOString() };
        const novo = rotaNome === 'tarefas' ? { ...base, concluida: false, concluida_em: null } : { ...base, status: 'ativa' as const, concluida_em: null };
        lista.push(novo as never);
        return json(201, novo);
      }
      const item = lista.find((x) => x.id === partes[2]);
      if (!item) return json(404, { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } });
      if (metodo === 'PATCH') {
        const c = corpo as { titulo?: string; area?: string; prazo?: string | null; concluida?: boolean; status?: 'ativa' | 'concluida' };
        if (c.titulo !== undefined) item.titulo = c.titulo.trim();
        if (c.area !== undefined) item.area = c.area;
        if (c.prazo !== undefined) item.prazo = c.prazo;
        if (c.concluida !== undefined) { item.concluida = c.concluida; item.concluida_em = c.concluida ? new Date().toISOString() : null; }
        if (c.status !== undefined) { item.status = c.status; item.concluida_em = c.status === 'concluida' ? new Date().toISOString() : null; }
        return json(200, item);
      }
      lista.splice(lista.indexOf(item), 1);
      return rota.fulfill({ status: 204 });
    });
  }
  return f;
}

// ---- Voz: POST /api/voz simulado + microfone falso do Chromium (--use-fake-device-for-media-stream) ----
export type PlanoVoz = 'ok' | 'falha' | 'vazio' | 'limite' | '401';
export interface PedidoVoz { contentType: string; arquivo: string; tipoArquivo: string; bytes: number; duracaoMs: number | null }
export interface VozFalsa {
  /** Resultado de cada POST /api/voz, na ordem (padrão: ok). */
  planos: PlanoVoz[];
  texto: string;
  /** Atraso (ms) antes de responder (para ver o "Transcrevendo áudio…"). */
  atrasoMs: number;
  pedidos: PedidoVoz[];
}

export async function simularVoz(page: Page, inicial: Partial<VozFalsa> = {}): Promise<VozFalsa> {
  const v: VozFalsa = { planos: [], texto: 'preciso organizar a visita do cliente amanhã', atrasoMs: 0, pedidos: [], ...inicial };
  await page.route((url) => url.pathname === '/api/voz', async (rota) => {
    const corpo = (rota.request().postDataBuffer() ?? Buffer.alloc(0)).toString('latin1');
    const arquivo = /name="audio"; filename="([^"]*)"\r\nContent-Type: ([^\r\n]*)/.exec(corpo);
    const duracao = /name="duracao_ms"\r\n\r\n(\d+)/.exec(corpo);
    v.pedidos.push({
      contentType: rota.request().headers()['content-type'] ?? '',
      arquivo: arquivo?.[1] ?? '',
      tipoArquivo: arquivo?.[2] ?? '',
      bytes: rota.request().postDataBuffer()?.length ?? 0,
      duracaoMs: duracao ? Number(duracao[1]) : null,
    });
    if (v.atrasoMs) await new Promise((r) => setTimeout(r, v.atrasoMs));
    const plano = v.planos.shift() ?? 'ok';
    if (plano === 'falha') return rota.fulfill({ status: 500, json: { erro: { codigo: 'transcricao_falhou', mensagem: 'Não entendi o áudio. Tenta de novo ou digita.' } } });
    if (plano === 'limite') return rota.fulfill({ status: 429, json: { erro: { codigo: 'limite_voz', mensagem: 'Limite de voz de hoje atingido. Digite sua mensagem.' } } });
    if (plano === '401') return rota.fulfill({ status: 401, json: { erro: { codigo: 'nao_autenticado', mensagem: 'Entre de novo.' } } });
    return rota.fulfill({ status: 200, json: { texto: plano === 'vazio' ? '' : v.texto } });
  });
  return v;
}

/**
 * Microfone: dá a permissão e guarda cada MediaStream aberto (window.__fluxos) para conferir que as trilhas são encerradas.
 * Com `negar`, getUserMedia falha como quando o Marco nega a permissão (NotAllowedError).
 */
export async function prepararMicrofone(page: Page, opcoes: { negar?: boolean } = {}) {
  await page.context().grantPermissions(['microphone']);
  await page.addInitScript((negar) => {
    const w = window as unknown as { __fluxos: MediaStream[]; __pedidosMic: number };
    w.__fluxos = [];
    w.__pedidosMic = 0;
    const md = navigator.mediaDevices;
    const original = md.getUserMedia.bind(md);
    md.getUserMedia = async (restricoes) => {
      w.__pedidosMic++;
      if (negar) throw new DOMException('Permission denied', 'NotAllowedError');
      const fluxo = await original(restricoes);
      w.__fluxos.push(fluxo);
      return fluxo;
    };
  }, !!opcoes.negar);
}

/** Quantas trilhas de microfone continuam ao vivo (0 = o microfone foi liberado). */
export const trilhasAoVivo = (page: Page) =>
  page.evaluate(() => (window as unknown as { __fluxos: MediaStream[] }).__fluxos.flatMap((f) => f.getTracks()).filter((t) => t.readyState === 'live').length);
export const microfonesPedidos = (page: Page) => page.evaluate(() => (window as unknown as { __pedidosMic: number }).__pedidosMic);
