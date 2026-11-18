// Adaptador da API de mensagens da Anthropic (fetch puro: funciona no Workers, sem SDK).
// Regras do modelo (skill claude-api, claude-haiku-5-5 e claude-sonnet-5-5):
//  - nada de prefill, temperature/top_p/top_k nem thinking.budget_tokens (todos dão 400);
//  - o raciocínio é adaptativo (padrão) e controlado por output_config.effort (low/medium/high);
//  - o texto do raciocínio vem omitido por padrão; blocos "thinking" são ignorados aqui;
//  - stop_reason "refusal" chega com HTTP 200 e vira ErroIA('recusa');
//  - fallbacks do servidor só existem para o modelo profundo (o Haiku não tem fallback de recusa);
//  - ferramentas: strict: true, tool_choice automático (tool_choice forçado dá 400 no Sonnet 5.5), additionalProperties: false
//    e sem minLength/maxLength no schema (não suportados com strict: os limites são validados com Zod no servidor);
//  - o texto vem antes das ferramentas (pedido no prompt) e NÃO há segunda chamada depois delas: a resposta termina em tool_use.
import { ErroIA, type ClienteIA, type EventoIA, type PedidoIA, type TipoSugestao, type UsoIA } from './tipos';

export const URL_MENSAGENS = 'https://api.anthropic.com/v1/messages';
export const VERSAO_API = '2023-06-01';
export const BETA_FALLBACK = 'server-side-fallback-2026-07-01';

const AREAS_ITEM = ['trabalho', 'financas', 'saude', 'casa'];
const AREAS_MEMORIA = ['sobre_mim', ...AREAS_ITEM];

/** Ferramentas de sugestão (arquitetura.md §4): strict, tool_choice auto. */
export const FERRAMENTAS: Array<{ name: string; tipo: TipoSugestao; description: string; strict: true; input_schema: Record<string, unknown> }> = [
  {
    name: 'sugerir_tarefa',
    tipo: 'tarefa',
    description: 'Propõe uma tarefa ao Marco. Ele decide se salva. Use só depois de escrever a resposta em texto.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título curto da tarefa (até 120 caracteres).' },
        area: { type: 'string', enum: AREAS_ITEM },
        prazo: { type: 'string', description: 'Data AAAA-MM-DD, só se o Marco falou de prazo.' },
      },
      required: ['titulo', 'area'],
      additionalProperties: false,
    },
  },
  {
    name: 'sugerir_meta',
    tipo: 'meta',
    description: 'Propõe uma meta ao Marco. Ele decide se salva. Use só depois de escrever a resposta em texto.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título curto da meta (até 120 caracteres).' },
        area: { type: 'string', enum: AREAS_ITEM },
        prazo: { type: 'string', description: 'Data AAAA-MM-DD, só se o Marco falou de prazo.' },
      },
      required: ['titulo', 'area'],
      additionalProperties: false,
    },
  },
  {
    name: 'sugerir_memoria',
    tipo: 'memoria',
    description: 'Propõe guardar um fato duradouro sobre o Marco. Ele decide se salva. Nunca repita uma memória que já existe.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'O fato, em uma frase (até 300 caracteres).' },
        area: { type: 'string', enum: AREAS_MEMORIA },
      },
      required: ['texto', 'area'],
      additionalProperties: false,
    },
  },
];

export interface OpcoesClaude {
  apiKey: string;
  /** Injetável nos testes. */
  fetch?: typeof fetch;
  /** Espera entre tentativas (injetável nos testes). */
  esperar?: (ms: number) => Promise<void>;
  /** Tentativas extras em erro 5xx/529/429 antes de qualquer texto. */
  tentativasExtras?: number;
}

/** Monta o corpo da requisição (exportado para teste). */
export function montarCorpo(p: PedidoIA, comFallback: boolean): Record<string, unknown> {
  const sistema: Array<Record<string, unknown>> = [
    // Ponto de cache ao fim do bloco estável (memórias, metas e tarefas incluídas).
    { type: 'text', text: p.sistemaEstavel, cache_control: { type: 'ephemeral' } },
  ];
  if (p.sistemaVolatil) sistema.push({ type: 'text', text: p.sistemaVolatil });
  const corpo: Record<string, unknown> = {
    model: p.modelo,
    max_tokens: p.maxTokens,
    stream: true,
    system: sistema,
    messages: p.mensagens.map((m) => ({ role: m.papel, content: m.texto })),
  };
  if (p.esforco) corpo.output_config = { effort: p.esforco };
  const ligadas = FERRAMENTAS.filter((f) => p.ferramentas?.includes(f.tipo));
  if (ligadas.length) {
    // `tipo` é só nosso (não faz parte do schema da API): sai do corpo.
    corpo.tools = ligadas.map(({ tipo: _tipo, ...ferramenta }) => ferramenta);
    corpo.tool_choice = { type: 'auto' };
  }
  if (comFallback) corpo.fallbacks = 'default';
  return corpo;
}

function tipoDeStatus(status: number, tipoApi?: string): ErroIA {
  if (status === 401 || status === 403) return new ErroIA('autenticacao', 'Chave da IA recusada.', status);
  if (status === 429 || tipoApi === 'rate_limit_error') return new ErroIA('limite', 'Limite da IA atingido.', status);
  if (status >= 500 || tipoApi === 'overloaded_error' || tipoApi === 'api_error') return new ErroIA('indisponivel', 'IA indisponível.', status);
  return new ErroIA('requisicao', `Pedido recusado pela IA (${tipoApi ?? status}).`, status);
}

function usoVazio(): UsoIA {
  return { tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, tokensCacheCriado: 0 };
}

interface DadosSse {
  type: string;
  [k: string]: unknown;
}

/** Lê o corpo SSE da Anthropic e devolve os objetos JSON de cada evento. */
async function* lerSse(corpo: ReadableStream<Uint8Array>): AsyncGenerator<DadosSse> {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let resto = '';
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      resto += decodificador.decode(value, { stream: true });
      let i: number;
      while ((i = resto.search(/\r?\n\r?\n/)) >= 0) {
        const bloco = resto.slice(0, i);
        resto = resto.slice(i).replace(/^\r?\n\r?\n/, '');
        const dados = bloco.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
        if (!dados) continue;
        try {
          yield JSON.parse(dados) as DadosSse;
        } catch {
          /* linha malformada: ignora */
        }
      }
    }
  } finally {
    leitor.releaseLock();
  }
}

export function criarClienteClaude(opcoes: OpcoesClaude): ClienteIA {
  const buscar = opcoes.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const esperar = opcoes.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const extras = opcoes.tentativasExtras ?? 1;

  async function pedir(p: PedidoIA, sinal: AbortSignal | undefined, comFallback: boolean): Promise<Response> {
    const cabecalhos: Record<string, string> = {
      'x-api-key': opcoes.apiKey,
      'anthropic-version': VERSAO_API,
      'content-type': 'application/json',
    };
    if (comFallback) cabecalhos['anthropic-beta'] = BETA_FALLBACK;
    try {
      return await buscar(URL_MENSAGENS, { method: 'POST', headers: cabecalhos, body: JSON.stringify(montarCorpo(p, comFallback)), signal: sinal });
    } catch (e) {
      if (sinal?.aborted || (e instanceof Error && e.name === 'AbortError')) throw new ErroIA('cancelado', 'Cancelado.');
      throw new ErroIA('rede', 'Sem conexão com a IA.');
    }
  }

  async function abrir(p: PedidoIA, sinal?: AbortSignal): Promise<Response> {
    let comFallback = !!p.fallbackRecusa;
    for (let tentativa = 0; ; tentativa++) {
      const resp = await pedir(p, sinal, comFallback);
      if (resp.ok && resp.body) return resp;
      let tipoApi: string | undefined;
      try {
        const j = (await resp.json()) as { error?: { type?: string } };
        tipoApi = j.error?.type;
      } catch {
        /* corpo vazio */
      }
      // Qualquer 400 com fallback/beta: plano B, uma única vez, sem fallback e sem beta (a conversa continua funcionando).
      if (resp.status === 400 && comFallback) {
        console.warn('ia plano B: refazendo sem fallback/beta', { modelo: p.modelo, tipo: tipoApi });
        comFallback = false;
        continue;
      }
      const erro = tipoDeStatus(resp.status, tipoApi);
      if ((erro.tipo === 'indisponivel' || erro.tipo === 'limite') && tentativa < extras) {
        await esperar(800 * (tentativa + 1));
        continue;
      }
      throw erro;
    }
  }

  return {
    async *transmitir(pedido: PedidoIA, sinal?: AbortSignal): AsyncGenerator<EventoIA> {
      const resp = await abrir(pedido, sinal);
      const uso = usoVazio();
      let modelo = pedido.modelo;
      let parou: string | undefined;
      let terminou = false;
      const ferramentas = new Map<number, { nome: string; json: string }>();

      try {
        for await (const ev of lerSse(resp.body!)) {
          switch (ev.type) {
            case 'message_start': {
              const m = ev.message as { model?: string; usage?: Record<string, number> };
              if (m.model) modelo = m.model;
              uso.tokensEntrada = m.usage?.input_tokens ?? 0;
              uso.tokensCache = m.usage?.cache_read_input_tokens ?? 0;
              uso.tokensCacheCriado = m.usage?.cache_creation_input_tokens ?? 0;
              uso.tokensSaida = m.usage?.output_tokens ?? 0;
              break;
            }
            case 'content_block_start': {
              const b = ev.content_block as { type: string; name?: string };
              if (b.type === 'tool_use') ferramentas.set(ev.index as number, { nome: b.name ?? '', json: '' });
              break;
            }
            case 'content_block_delta': {
              const d = ev.delta as { type: string; text?: string; partial_json?: string };
              if (d.type === 'text_delta' && d.text) yield { tipo: 'texto', delta: d.text };
              else if (d.type === 'input_json_delta') {
                const f = ferramentas.get(ev.index as number);
                if (f) f.json += d.partial_json ?? '';
              }
              break;
            }
            case 'content_block_stop': {
              const f = ferramentas.get(ev.index as number);
              if (f) {
                ferramentas.delete(ev.index as number);
                try {
                  yield { tipo: 'sugestao', nome: f.nome, entrada: JSON.parse(f.json || '{}') };
                } catch {
                  // Entrada truncada ou inválida: descarta a sugestão e registra (só o nome da ferramenta, nunca o conteúdo).
                  console.warn('ia sugestão descartada: JSON inválido', { ferramenta: f.nome });
                }
              }
              break;
            }
            case 'message_delta': {
              const d = ev.delta as { stop_reason?: string };
              const u = ev.usage as Record<string, number> | undefined;
              if (d.stop_reason) parou = d.stop_reason;
              if (u?.output_tokens !== undefined) uso.tokensSaida = u.output_tokens;
              if (u?.input_tokens !== undefined && u.input_tokens > 0) uso.tokensEntrada = u.input_tokens;
              if (u?.cache_read_input_tokens !== undefined) uso.tokensCache = u.cache_read_input_tokens;
              break;
            }
            case 'message_stop':
              terminou = true;
              break;
            case 'error': {
              const e = ev.error as { type?: string } | undefined;
              throw tipoDeStatus(e?.type === 'overloaded_error' || e?.type === 'api_error' ? 500 : e?.type === 'rate_limit_error' ? 429 : 400, e?.type);
            }
          }
        }
      } catch (e) {
        if (e instanceof ErroIA) throw e;
        if (sinal?.aborted || (e instanceof Error && e.name === 'AbortError')) throw new ErroIA('cancelado', 'Cancelado.');
        throw new ErroIA('rede', 'Resposta da IA interrompida.');
      }

      if (parou === 'refusal') throw new ErroIA('recusa', 'A IA recusou o pedido.');
      if (!terminou) throw new ErroIA('rede', 'Resposta da IA interrompida.');
      yield { tipo: 'fim', modelo, uso, truncada: parou === 'max_tokens' };
    },
  };
}
