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
export interface ConversaFalsa {
  id: string; titulo: string | null; tipo: 'normal'; modo: 'padrao' | 'decidir'; criada_em: string; atualizada_em: string; mensagens: MsgFalsa[];
}

export interface ChatFalso {
  conversas: ConversaFalsa[];
  /** Conversa devolvida por GET /api/conversas/hoje (null = nenhuma). */
  hoje: string | null;
  /** Resultado de cada POST de mensagem, na ordem (padrão: ok). */
  planos: Plano[];
  /** Atraso (ms) antes de responder a um POST de mensagem. */
  atrasoMs: number;
  /** Atraso (ms) antes de responder a GET /api/conversas (lista do histórico). */
  atrasoListaMs: number;
  /** Faz GET /api/conversas falhar (500). */
  listaFalha: boolean;
  postsMensagem: Array<{ conversa: string; id: string; texto: string }>;
  postsConversa: Array<Record<string, unknown>>;
  deletes: string[];
}

const iso = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export function novaConversa(id: string, titulo: string | null, minutosAtras = 0, modo: 'padrao' | 'decidir' = 'padrao', mensagens: Array<[string, string]> = []): ConversaFalsa {
  return {
    id, titulo, tipo: 'normal', modo, criada_em: iso(minutosAtras), atualizada_em: iso(minutosAtras),
    mensagens: mensagens.map(([autor, texto], i) => ({ id: `${id}-m${i}`, autor: autor as 'marco' | 'jose', texto, origem: 'texto', modelo: autor === 'jose' ? 'claude-haiku-5-5' : null, criada_em: iso(minutosAtras) })),
  };
}

const sse = (eventos: Array<[string, unknown]>) => eventos.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
const resumo = (c: ConversaFalsa) => ({ id: c.id, titulo: c.titulo, tipo: c.tipo, modo: c.modo, atualizada_em: c.atualizada_em });
const completa = (c: ConversaFalsa) => ({ conversa: { id: c.id, titulo: c.titulo, tipo: c.tipo, modo: c.modo, criada_em: c.criada_em, atualizada_em: c.atualizada_em }, mensagens: c.mensagens, sugestoes: [] });

export async function simularChat(page: Page, inicial: Partial<ChatFalso> = {}): Promise<ChatFalso> {
  const f: ChatFalso = { conversas: [], hoje: null, planos: [], atrasoMs: 0, atrasoListaMs: 0, listaFalha: false, postsMensagem: [], postsConversa: [], deletes: [], ...inicial };
  let proximo = 1;
  const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      return conversa ? json(200, completa(conversa)) : json(404, { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } });
    }
    // POST /api/conversas/:id/mensagens
    if (!conversa) return json(404, { erro: { codigo: 'nao_encontrado', mensagem: 'Não encontrado.' } });
    const msg = req.postDataJSON() as { id: string; texto: string; origem: 'texto' | 'voz' };
    f.postsMensagem.push({ conversa: conversa.id, id: msg.id, texto: msg.texto });
    if (f.atrasoMs) await espera(f.atrasoMs);
    const plano = f.planos.shift() ?? 'ok';
    if (plano === '401') return json(401, { erro: { codigo: 'nao_autenticado', mensagem: 'Entre de novo.' } });
    if (plano === 'limite') return json(429, { erro: { codigo: 'limite_diario', mensagem: 'Limite de hoje atingido, volta amanhã.' } });
    const existente = conversa.mensagens.findIndex((m) => m.id === msg.id);
    if (existente < 0) conversa.mensagens.push({ id: msg.id, autor: 'marco', texto: msg.texto, origem: msg.origem, modelo: null, criada_em: iso(0) });
    const corpoSse = (eventos: Array<[string, unknown]>) => rota.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(eventos) });
    if (plano === 'erro-ia') return corpoSse([['erro', { codigo: 'ia_indisponivel', mensagem: 'O José não conseguiu responder agora.' }]]);
    if (plano === 'cortada') return corpoSse([['texto', { delta: 'Resposta pela metade' }]]);
    const resposta: MsgFalsa = { id: `${msg.id}-resp`, autor: 'jose', texto: 'Resposta do José. Próximo passo: abrir o arquivo.', origem: 'texto', modelo: 'claude-haiku-5-5', criada_em: iso(0) };
    const jaTinha = conversa.mensagens.some((m) => m.id === resposta.id);
    if (!jaTinha) conversa.mensagens.push(resposta);
    conversa.atualizada_em = iso(0);
    const titulo = conversa.titulo ? undefined : 'Título de teste';
    if (titulo) conversa.titulo = titulo;
    return corpoSse([['texto', { delta: 'Resposta do José. ' }], ['texto', { delta: 'Próximo passo: abrir o arquivo.' }], ['fim', titulo ? { mensagem_id: resposta.id, titulo } : { mensagem_id: resposta.id }]]);
  });
  return f;
}
