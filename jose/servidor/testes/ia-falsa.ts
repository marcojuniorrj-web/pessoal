import { ErroIA, type ClienteIA, type EventoIA, type PedidoIA } from '../src/adaptadores/ia/tipos';

/** Um passo do roteiro da IA simulada: uma chamada a `transmitir`. */
export interface Passo {
  partes?: string[];
  sugestoes?: Array<{ nome: string; entrada: unknown }>;
  /** Lança este erro depois de entregar as `partes` (erro no meio do fluxo). */
  erro?: ErroIA;
  /** Fim com stop_reason max_tokens. */
  truncada?: boolean;
  uso?: Partial<{ tokensEntrada: number; tokensSaida: number; tokensCache: number }>;
}

/** IA simulada: responde conforme o roteiro (um passo por chamada) e guarda os pedidos recebidos. */
export function criarIaFalsa(roteiro: Passo[] | ((n: number, p: PedidoIA) => Passo), opcoes: { titulo?: string | Error } = {}) {
  const pedidos: PedidoIA[] = [];
  /** Chamadas de título (ficam fora de `pedidos` para não bagunçar o roteiro da conversa). */
  const pedidosTitulo: PedidoIA[] = [];
  const ia: ClienteIA = {
    async *transmitir(pedido): AsyncGenerator<EventoIA> {
      if (pedido.sistemaEstavel.includes('Você nomeia conversas')) {
        pedidosTitulo.push(pedido);
        const t = opcoes.titulo ?? 'Título de teste';
        if (t instanceof Error) throw t;
        yield { tipo: 'texto', delta: t };
        yield { tipo: 'fim', modelo: pedido.modelo, truncada: false, uso: { tokensEntrada: 10, tokensSaida: 5, tokensCache: 0, tokensCacheCriado: 0 } };
        return;
      }
      const n = pedidos.push(pedido) - 1;
      const passo = typeof roteiro === 'function' ? roteiro(n, pedido) : (roteiro[n] ?? roteiro.at(-1) ?? {});
      for (const delta of passo.partes ?? ['Resposta do José.']) yield { tipo: 'texto', delta };
      if (passo.erro) throw passo.erro;
      for (const s of passo.sugestoes ?? []) yield { tipo: 'sugestao', nome: s.nome, entrada: s.entrada };
      yield {
        tipo: 'fim', modelo: pedido.modelo, truncada: passo.truncada ?? false,
        uso: { tokensEntrada: 100, tokensSaida: 20, tokensCache: 0, tokensCacheCriado: 0, ...passo.uso },
      };
    },
  };
  return { ia, pedidos, pedidosTitulo };
}

export interface EventoSse {
  evento: string;
  dados: Record<string, unknown>;
}

/** Lê o corpo SSE de uma resposta e devolve os eventos. */
export async function lerEventos(resp: Response): Promise<EventoSse[]> {
  const texto = await resp.text();
  return texto
    .split('\n\n')
    .filter((b) => b.trim())
    .map((bloco) => {
      const linhas = bloco.split('\n');
      return {
        evento: linhas.find((l) => l.startsWith('event:'))!.slice(6).trim(),
        dados: JSON.parse(linhas.find((l) => l.startsWith('data:'))!.slice(5).trim()) as Record<string, unknown>,
      };
    });
}
