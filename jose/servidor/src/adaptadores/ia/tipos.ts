// Contrato do adaptador de IA: a regra de negócio só conhece estes tipos (nunca a API da Anthropic).

export interface MensagemIA {
  papel: 'user' | 'assistant';
  texto: string;
}

export interface PedidoIA {
  modelo: string;
  maxTokens: number;
  /** Esforço de raciocínio (Haiku 5.5 e Sonnet 5.5 aceitam low/medium/high). */
  esforco?: 'low' | 'medium' | 'high';
  /** Prefixo estável (prompt, memórias, metas, tarefas): recebe o ponto de cache. */
  sistemaEstavel: string;
  /** Depois do ponto de cache: data/hora e instruções que mudam por conversa. */
  sistemaVolatil: string;
  /** Sempre começa e termina com "user", alternando papéis. */
  mensagens: MensagemIA[];
  /** Liga as ferramentas sugerir_tarefa / sugerir_meta / sugerir_memoria. */
  ferramentas?: boolean;
  /** Pede ao provedor um novo modelo quando o profundo recusar (só o modelo profundo suporta). */
  fallbackRecusa?: boolean;
}

export interface UsoIA {
  tokensEntrada: number;
  tokensSaida: number;
  /** Tokens lidos do cache (cache_read_input_tokens). */
  tokensCache: number;
  /** Tokens gravados no cache (só para medir se o cache está pegando). */
  tokensCacheCriado: number;
}

export type EventoIA =
  | { tipo: 'texto'; delta: string }
  | { tipo: 'sugestao'; nome: string; entrada: unknown }
  | { tipo: 'fim'; modelo: string; uso: UsoIA; truncada: boolean };

export type TipoErroIA = 'indisponivel' | 'limite' | 'recusa' | 'requisicao' | 'autenticacao' | 'rede' | 'cancelado';

/** Erro tipado do adaptador. A mensagem nunca carrega conteúdo de conversa. */
export class ErroIA extends Error {
  constructor(
    readonly tipo: TipoErroIA,
    mensagem: string,
    readonly status?: number,
  ) {
    super(mensagem);
    this.name = 'ErroIA';
  }
}

export interface ClienteIA {
  /** Transmite a resposta em eventos. Lança ErroIA (também no meio do fluxo). */
  transmitir(pedido: PedidoIA, sinal?: AbortSignal): AsyncIterable<EventoIA>;
}

/** Junta só o texto de um fluxo (usado no título). */
export async function coletarTexto(fluxo: AsyncIterable<EventoIA>): Promise<string> {
  let texto = '';
  for await (const e of fluxo) if (e.tipo === 'texto') texto += e.delta;
  return texto;
}
