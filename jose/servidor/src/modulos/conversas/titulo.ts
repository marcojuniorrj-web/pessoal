import { coletarTexto, type ClienteIA } from '../../adaptadores/ia/tipos';

export const MAX_PALAVRAS_TITULO = 6;
export const MAX_CARACTERES_FALLBACK = 40;

/** Título de reserva: os 40 primeiros caracteres da 1ª mensagem do Marco (dados.md, regra 4). */
export function tituloFallback(primeiraMensagem: string): string {
  return primeiraMensagem.replace(/\s+/g, ' ').trim().slice(0, MAX_CARACTERES_FALLBACK).trim() || 'Nova conversa';
}

/** Limpa a saída da IA: 1ª linha, sem aspas/markdown/ponto final, no máximo 6 palavras. */
export function limparTitulo(bruto: string): string {
  const linha = bruto.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const limpo = linha.replace(/[*_#`"“”«»']/g, '').replace(/^(título|titulo)\s*:\s*/i, '').replace(/[.!?…:;,\s]+$/g, '').trim();
  return limpo.split(/\s+/).filter(Boolean).slice(0, MAX_PALAVRAS_TITULO).join(' ');
}

/** Pede ao modelo econômico um título curto. Qualquer falha (ou saída vazia) usa o fallback. */
export async function gerarTitulo(
  ia: ClienteIA,
  opcoes: { modelo: string; promptTitulo: string; primeiraMensagem: string; resposta: string; sinal?: AbortSignal },
): Promise<string> {
  try {
    const bruto = await coletarTexto(
      ia.transmitir(
        {
          modelo: opcoes.modelo,
          maxTokens: 200, // folga: o raciocínio adaptativo também conta no limite
          esforco: 'low',
          sistemaEstavel: opcoes.promptTitulo,
          sistemaVolatil: '',
          mensagens: [{ papel: 'user', texto: `Mensagem do Marco:\n${opcoes.primeiraMensagem}\n\nResposta do José:\n${opcoes.resposta}` }],
        },
        opcoes.sinal,
      ),
    );
    return limparTitulo(bruto) || tituloFallback(opcoes.primeiraMensagem);
  } catch {
    return tituloFallback(opcoes.primeiraMensagem);
  }
}
