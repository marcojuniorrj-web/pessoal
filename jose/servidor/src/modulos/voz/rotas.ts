import { Hono } from 'hono';
import { hoje } from '@compartilhado/datas';
import type { Dependencias } from '../../compartilhado/dependencias';
import { ErroApi, requisicaoInvalida } from '../../compartilhado/erros';
import type { AppEnv } from '../auth/sessao';
import { consumirTranscricao } from './repositorio';

export const LIMITE_AUDIO_BYTES = 10 * 1024 * 1024;
/** Até 60 transcrições por dia local (dados.md, regra 9). */
export const LIMITE_TRANSCRICOES_DIA = 60;
/** O app para a gravação aos 2:00; a folga de 5 s cobre o atraso do relógio e do fechamento do arquivo. */
export const DURACAO_MAXIMA_MS = 125_000;
export const MENSAGEM_LIMITE_VOZ = 'Limite de voz de hoje atingido. Digite sua mensagem.';
export const MENSAGEM_FALHA_VOZ = 'Não entendi o áudio. Tenta de novo ou digita.';

/** Tipos aceitos (sem parâmetros como `;codecs=opus`). video/mp4 e video/webm só por defesa: alguns navegadores rotulam assim o áudio. */
const TIPOS_ACEITOS = new Set([
  'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'video/mp4', 'video/webm',
]);

/** `audio/webm;codecs=opus` → `audio/webm`. */
export function tipoBase(contentType: string): string {
  return contentType.split(';')[0]!.trim().toLowerCase();
}

function lerDuracaoMs(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{1,9}$/.test(valor)) throw requisicaoInvalida('Duração do áudio inválida.');
  return Number(valor);
}

export function rotasVoz(deps: Pick<Dependencias, 'transcritor' | 'agora'>) {
  const rotas = new Hono<AppEnv>();

  // multipart: audio (até 10 MB) e duracao_ms (opcional). O áudio é lido em memória, transcrito e descartado (nunca gravado).
  // Sessão e Origin já foram exigidos pelo middleware de /api (como nas demais rotas).
  rotas.post('/voz', async (c) => {
    const declarado = Number(c.req.header('content-length') ?? 0);
    if (declarado > LIMITE_AUDIO_BYTES + 64 * 1024) throw new ErroApi(413, 'audio_grande', 'Áudio muito grande (máximo 10 MB).');

    let formulario: FormData;
    try {
      formulario = await c.req.formData();
    } catch {
      throw requisicaoInvalida('Envie o áudio no campo "audio".');
    }
    const arquivo = formulario.get('audio');
    if (!(arquivo instanceof File)) throw requisicaoInvalida('Envie o áudio no campo "audio".');
    if (arquivo.size > LIMITE_AUDIO_BYTES) throw new ErroApi(413, 'audio_grande', 'Áudio muito grande (máximo 10 MB).');
    if (arquivo.size === 0) throw requisicaoInvalida('Áudio vazio.');
    const tipo = tipoBase(arquivo.type);
    if (!TIPOS_ACEITOS.has(tipo)) throw requisicaoInvalida('Formato de áudio não aceito.');
    const duracaoMs = lerDuracaoMs(formulario.get('duracao_ms'));
    if (duracaoMs !== null && duracaoMs > DURACAO_MAXIMA_MS) throw new ErroApi(400, 'audio_longo', 'Áudio longo demais (máximo 2 minutos).');

    const transcritor = deps.transcritor(c.env);
    if (!transcritor) throw new ErroApi(500, 'voz_indisponivel', 'Transcrição indisponível neste ambiente.');

    // Limite diário: conta ANTES de chamar o Whisper (e só depois de validar o pedido). Se o Whisper falhar a contagem fica:
    // devolvê-la permitiria gastar o serviço sem limite com áudios que sempre falham.
    const usuario = c.get('usuario');
    const dia = hoje(deps.agora(), usuario.fuso_horario);
    if (!(await consumirTranscricao(c.env.DB, usuario.id, dia, LIMITE_TRANSCRICOES_DIA))) {
      console.warn('voz limite diário', { usuario: usuario.id, dia });
      throw new ErroApi(429, 'limite_voz', MENSAGEM_LIMITE_VOZ);
    }

    const inicio = Date.now();
    try {
      const texto = await transcritor.transcrever(await arquivo.arrayBuffer());
      // Log só com tipo, tamanho e tempo; nunca o áudio nem o texto transcrito.
      console.log('voz ok', { tipo, bytes: arquivo.size, ms: Date.now() - inicio });
      return c.json({ texto });
    } catch (e) {
      console.error('voz falhou', { tipo, bytes: arquivo.size, ms: Date.now() - inicio, erro: e instanceof Error ? e.name : 'desconhecido' });
      throw new ErroApi(500, 'transcricao_falhou', MENSAGEM_FALHA_VOZ);
    }
  });

  return rotas;
}
