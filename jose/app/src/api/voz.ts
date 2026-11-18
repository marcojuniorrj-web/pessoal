import { nomeDoArquivo } from '../estado/gravacao';
import { ErroRede, erroDaResposta } from './cliente';

/**
 * Envia o áudio para `POST /api/voz` e devolve o texto transcrito (pode vir vazio). O áudio só existe em memória:
 * o servidor o transcreve e o descarta. Lança ErroHttp (401 dispara o tratamento global; 429 = limite de voz) ou ErroRede.
 * Um pedido cancelado por `sinal` lança o AbortError original.
 */
export async function transcreverAudio(audio: Blob, duracaoMs: number, sinal?: AbortSignal): Promise<string> {
  const formulario = new FormData();
  formulario.set('audio', audio, nomeDoArquivo(audio.type));
  formulario.set('duracao_ms', String(Math.round(duracaoMs)));
  let resp: Response;
  try {
    resp = await fetch('/api/voz', { method: 'POST', body: formulario, credentials: 'same-origin', signal: sinal });
  } catch (e) {
    if (sinal?.aborted) throw e;
    throw new ErroRede();
  }
  if (!resp.ok) throw await erroDaResposta(resp, '/api/voz');
  const json = (await resp.json().catch(() => ({}))) as { texto?: unknown };
  return typeof json.texto === 'string' ? json.texto : '';
}
