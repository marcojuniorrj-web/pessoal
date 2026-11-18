import type { ConversaCompleta, ConversaResumo, ModoConversa } from '@compartilhado/schemas';
import { api, ErroHttp, ErroRede, erroDaResposta } from './cliente';
import { criarParserSse } from './sse';

export const listarConversas = () => api.get<ConversaResumo[]>('/api/conversas');
export const conversaDeHoje = () => api.get<ConversaCompleta | null>('/api/conversas/hoje');
export const abrirConversa = (id: string) => api.get<ConversaCompleta>(`/api/conversas/${encodeURIComponent(id)}`);
export const criarConversa = (modo: ModoConversa) => api.post<{ id: string }>('/api/conversas', { tipo: 'normal', modo });
export const apagarConversa = (id: string) => api.delete(`/api/conversas/${encodeURIComponent(id)}`);

export interface MensagemParaEnviar {
  id: string;
  texto: string;
  origem: 'texto' | 'voz';
}

export type EventoChat =
  | { tipo: 'texto'; delta: string }
  | { tipo: 'sugestao'; id: string; sugestaoTipo: 'tarefa' | 'meta' | 'memoria'; conteudo: unknown; status: 'pendente' | 'salva' | 'descartada'; itemId: string | null }
  | { tipo: 'fim'; mensagemId: string; titulo?: string }
  | { tipo: 'erro'; codigo: string; mensagem: string };

/** Falha no meio do fluxo (conexão caiu ou o servidor encerrou sem `fim`). */
export class ErroInterrompido extends Error {
  constructor() {
    super('Resposta interrompida');
  }
}

/**
 * Envia a mensagem e lê a resposta em SSE, chamando `aoEvento` a cada pedaço.
 * Lança ErroHttp (401 dispara o tratamento global; 429 limite_diario), ErroRede ou ErroInterrompido.
 * Termina normalmente depois do evento `fim` ou `erro`.
 */
export async function enviarMensagem(conversaId: string, msg: MensagemParaEnviar, aoEvento: (e: EventoChat) => void, sinal?: AbortSignal): Promise<void> {
  const caminho = `/api/conversas/${encodeURIComponent(conversaId)}/mensagens`;
  let resp: Response;
  try {
    resp = await fetch(caminho, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(msg),
      signal: sinal,
    });
  } catch {
    throw new ErroRede();
  }
  if (!resp.ok) throw await erroDaResposta(resp, caminho);
  if (!resp.body) throw new ErroInterrompido();

  const parser = criarParserSse();
  const leitor = resp.body.getReader();
  const decodificador = new TextDecoder();
  let terminou = false;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      for (const ev of parser.alimentar(decodificador.decode(value, { stream: true }))) {
        const d = ev.dados as Record<string, unknown>;
        if (ev.evento === 'texto') aoEvento({ tipo: 'texto', delta: String(d.delta ?? '') });
        else if (ev.evento === 'sugestao') {
          // O servidor repete as sugestões ao reenviar uma mensagem já respondida: o status gravado vale (salva, descartada ou pendente).
          const status = d.status === 'salva' || d.status === 'descartada' ? d.status : 'pendente';
          aoEvento({ tipo: 'sugestao', id: String(d.id), sugestaoTipo: d.tipo as 'tarefa', conteudo: d.conteudo, status, itemId: typeof d.item_id === 'string' ? d.item_id : null });
        }
        else if (ev.evento === 'fim') {
          terminou = true;
          aoEvento({ tipo: 'fim', mensagemId: String(d.mensagem_id), titulo: typeof d.titulo === 'string' ? d.titulo : undefined });
        } else if (ev.evento === 'erro') {
          terminou = true;
          aoEvento({ tipo: 'erro', codigo: String(d.codigo), mensagem: String(d.mensagem) });
        }
      }
    }
  } catch {
    if (!terminou) throw new ErroInterrompido();
  }
  if (!terminou) throw new ErroInterrompido();
}

/** Apaga uma mensagem; `comResposta` leva também a resposta do José logo depois. Um 404 (já apagada) conta como feito. */
export async function apagarMensagem(id: string, comResposta = false): Promise<void> {
  try {
    await api.delete(`/api/mensagens/${encodeURIComponent(id)}${comResposta ? '?com_resposta=1' : ''}`);
  } catch (e) {
    if (e instanceof ErroHttp && e.status === 404) return;
    throw e;
  }
}
