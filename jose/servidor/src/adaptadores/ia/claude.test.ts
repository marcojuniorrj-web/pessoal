import { describe, expect, it, vi } from 'vitest';
import { BETA_FALLBACK, criarClienteClaude, montarCorpo } from './claude';
import { coletarTexto, ErroIA, type EventoIA, type PedidoIA } from './tipos';

const pedido: PedidoIA = {
  modelo: 'claude-haiku-5-5', maxTokens: 600, esforco: 'low',
  sistemaEstavel: 'ESTAVEL', sistemaVolatil: 'VOLATIL',
  mensagens: [{ papel: 'user', texto: 'oi' }],
};

const enc = new TextEncoder();
/** Resposta SSE simulada; `partes` permite quebrar o texto em pedaços arbitrários (como a rede faz). */
function sse(eventos: Array<Record<string, unknown>>, partir = 1): Response {
  const texto = eventos.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const tam = Math.ceil(texto.length / partir);
  const corpo = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < texto.length; i += tam) c.enqueue(enc.encode(texto.slice(i, i + tam)));
      c.close();
    },
  });
  return new Response(corpo, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const inicio = { type: 'message_start', message: { model: 'claude-haiku-5-5', usage: { input_tokens: 120, cache_read_input_tokens: 900, cache_creation_input_tokens: 0, output_tokens: 1 } } };
const texto = (i: number, t: string) => ({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: t } });
const fim = (stop: string, out = 17) => [{ type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: out } }, { type: 'message_stop' }];

async function todos(fluxo: AsyncIterable<EventoIA>) {
  const e: EventoIA[] = [];
  for await (const x of fluxo) e.push(x);
  return e;
}
const erroResp = (status: number, tipo: string) => new Response(JSON.stringify({ type: 'error', error: { type: tipo, message: 'x' } }), { status });

describe('adaptador Claude: streaming', () => {
  it('entrega o texto em partes (mesmo com a rede quebrando os eventos) e captura o usage', async () => {
    const f = vi.fn(async () => sse([
      inicio,
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      texto(1, 'Bom '), texto(1, 'dia, '), texto(1, 'Marco.'),
      { type: 'content_block_stop', index: 1 },
      ...fim('end_turn', 42),
    ], 7));
    const eventos = await todos(criarClienteClaude({ apiKey: 'k', fetch: f as unknown as typeof fetch }).transmitir(pedido));
    expect(eventos.filter((e) => e.tipo === 'texto').map((e) => (e as { delta: string }).delta)).toEqual(['Bom ', 'dia, ', 'Marco.']);
    expect(eventos.at(-1)).toEqual({
      tipo: 'fim', modelo: 'claude-haiku-5-5', truncada: false,
      uso: { tokensEntrada: 120, tokensSaida: 42, tokensCache: 900, tokensCacheCriado: 0 },
    });
  });

  it('marca resposta cortada por max_tokens como truncada', async () => {
    const f = async () => sse([inicio, texto(0, 'abc'), ...fim('max_tokens')]);
    const e = await todos(criarClienteClaude({ apiKey: 'k', fetch: f as unknown as typeof fetch }).transmitir(pedido));
    expect(e.at(-1)).toMatchObject({ tipo: 'fim', truncada: true });
  });

  it('monta a requisição: cache_control no prefixo, sem parâmetros proibidos', async () => {
    const f = vi.fn(async (_u: unknown, _i: unknown) => sse([inicio, ...fim('end_turn')]));
    await todos(criarClienteClaude({ apiKey: 'chave-teste', fetch: f as unknown as typeof fetch }).transmitir({ ...pedido, ferramentas: true }));
    const [url, init] = f.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const h = init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('chave-teste');
    expect(h['anthropic-version']).toBe('2023-06-01');
    expect(h['anthropic-beta']).toBeUndefined();
    const corpo = JSON.parse(init.body as string);
    expect(corpo.system).toEqual([{ type: 'text', text: 'ESTAVEL', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'VOLATIL' }]);
    expect(corpo).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 600, stream: true, output_config: { effort: 'low' }, tool_choice: { type: 'auto' } });
    expect(corpo.tools.map((t: { name: string; strict: boolean }) => [t.name, t.strict])).toEqual([['sugerir_tarefa', true], ['sugerir_meta', true], ['sugerir_memoria', true]]);
    for (const proibido of ['temperature', 'top_p', 'top_k', 'thinking']) expect(corpo).not.toHaveProperty(proibido);
    // a última mensagem é do usuário (sem prefill)
    expect(corpo.messages.at(-1).role).toBe('user');
  });

  it('troca de modelo: o profundo usa fallback de recusa, o padrão não', async () => {
    expect(montarCorpo({ ...pedido, modelo: 'claude-sonnet-5-5', maxTokens: 1500, fallbackRecusa: true }, true)).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 1500, fallbacks: 'default' });
    expect(montarCorpo(pedido, false)).not.toHaveProperty('fallbacks');
    const f = vi.fn(async (_u: unknown, _i: unknown) => sse([inicio, ...fim('end_turn')]));
    await todos(criarClienteClaude({ apiKey: 'k', fetch: f as unknown as typeof fetch }).transmitir({ ...pedido, modelo: 'claude-sonnet-5-5', fallbackRecusa: true }));
    expect(((f.mock.calls[0]![1] as RequestInit).headers as Record<string, string>)['anthropic-beta']).toBe(BETA_FALLBACK);
  });

  it('se a conta não aceita o beta de fallback, refaz sem ele', async () => {
    const f = vi.fn(async (_u: unknown, i: unknown) => {
      const comBeta = !!((i as RequestInit).headers as Record<string, string>)['anthropic-beta'];
      return comBeta ? new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Unexpected value(s) `x` for the `anthropic-beta` header.' } }), { status: 400 }) : sse([inicio, texto(0, 'ok'), ...fim('end_turn')]);
    });
    const e = await todos(criarClienteClaude({ apiKey: 'k', fetch: f as unknown as typeof fetch }).transmitir({ ...pedido, fallbackRecusa: true }));
    expect(f).toHaveBeenCalledTimes(2);
    expect(e.some((x) => x.tipo === 'texto')).toBe(true);
  });

  it('entrega as sugestões das ferramentas, com o JSON montado por partes', async () => {
    const f = async () => sse([
      inicio, texto(0, 'Anotei.'),
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 't1', name: 'sugerir_tarefa', input: {} } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"titulo":"Ligar ' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: 'para o João","area":"trabalho"}' } },
      { type: 'content_block_stop', index: 1 },
      ...fim('tool_use'),
    ]);
    const e = await todos(criarClienteClaude({ apiKey: 'k', fetch: f as unknown as typeof fetch }).transmitir(pedido));
    expect(e).toContainEqual({ tipo: 'sugestao', nome: 'sugerir_tarefa', entrada: { titulo: 'Ligar para o João', area: 'trabalho' } });
  });
});

describe('adaptador Claude: erros tipados', () => {
  const semEspera = async () => {};
  it('erro 5xx: tenta de novo uma vez e depois falha como "indisponivel"', async () => {
    const f = vi.fn(async () => erroResp(500, 'api_error'));
    const c = criarClienteClaude({ apiKey: 'k', fetch: f as unknown as typeof fetch, esperar: semEspera });
    await expect(todos(c.transmitir(pedido))).rejects.toMatchObject({ name: 'ErroIA', tipo: 'indisponivel', status: 500 });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('5xx seguido de sucesso: a segunda tentativa resolve', async () => {
    const f = vi.fn().mockResolvedValueOnce(erroResp(529, 'overloaded_error')).mockImplementationOnce(async () => sse([inicio, texto(0, 'oi'), ...fim('end_turn')]));
    const e = await todos(criarClienteClaude({ apiKey: 'k', fetch: f as unknown as typeof fetch, esperar: semEspera }).transmitir(pedido));
    expect(await coletarTexto((async function* () { yield* e; })())).toBe('oi');
  });
  it('401, 400 e 429 viram autenticacao, requisicao e limite', async () => {
    for (const [status, tipoApi, esperado] of [[401, 'authentication_error', 'autenticacao'], [400, 'invalid_request_error', 'requisicao'], [429, 'rate_limit_error', 'limite']] as const) {
      const c = criarClienteClaude({ apiKey: 'k', fetch: (async () => erroResp(status, tipoApi)) as unknown as typeof fetch, esperar: semEspera, tentativasExtras: 0 });
      await expect(todos(c.transmitir(pedido))).rejects.toMatchObject({ tipo: esperado });
    }
  });
  it('recusa (stop_reason refusal, HTTP 200) vira ErroIA recusa', async () => {
    const f = async () => sse([inicio, ...fim('refusal', 0)]);
    await expect(todos(criarClienteClaude({ apiKey: 'k', fetch: f as unknown as typeof fetch }).transmitir(pedido))).rejects.toMatchObject({ tipo: 'recusa' });
  });
  it('erro no meio do fluxo e fluxo cortado viram erro tipado, sem "fim"', async () => {
    const meio = async () => sse([inicio, texto(0, 'a'), { type: 'error', error: { type: 'overloaded_error', message: 'x' } }]);
    await expect(todos(criarClienteClaude({ apiKey: 'k', fetch: meio as unknown as typeof fetch }).transmitir(pedido))).rejects.toMatchObject({ tipo: 'indisponivel' });
    const cortado = async () => sse([inicio, texto(0, 'a')]);
    await expect(todos(criarClienteClaude({ apiKey: 'k', fetch: cortado as unknown as typeof fetch }).transmitir(pedido))).rejects.toBeInstanceOf(ErroIA);
  });
  it('falha de rede e cancelamento', async () => {
    const queda = async () => { throw new TypeError('fetch failed'); };
    await expect(todos(criarClienteClaude({ apiKey: 'k', fetch: queda as unknown as typeof fetch }).transmitir(pedido))).rejects.toMatchObject({ tipo: 'rede' });
    const ctl = new AbortController();
    ctl.abort();
    const abortado = async () => { throw new DOMException('abort', 'AbortError'); };
    await expect(todos(criarClienteClaude({ apiKey: 'k', fetch: abortado as unknown as typeof fetch }).transmitir(pedido, ctl.signal))).rejects.toMatchObject({ tipo: 'cancelado' });
  });
});
