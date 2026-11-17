import { Hono } from 'hono';
import type { Dependencias } from '../../compartilhado/dependencias';
import { ErroApi, requisicaoInvalida } from '../../compartilhado/erros';
import type { AppEnv } from '../auth/sessao';

export const LIMITE_AUDIO_BYTES = 10 * 1024 * 1024;
const TIPOS_ACEITOS = /^(audio|video)\/(webm|mp4|x-m4a|m4a|aac|mpeg|ogg|wav|x-wav)$/;

export function rotasVoz(deps: Pick<Dependencias, 'transcritor'>) {
  const rotas = new Hono<AppEnv>();

  // multipart: audio (até 10 MB). O áudio é lido em memória, transcrito e descartado (nunca gravado).
  rotas.post('/voz', async (c) => {
    const declarado = Number(c.req.header('content-length') ?? 0);
    if (declarado > LIMITE_AUDIO_BYTES + 64 * 1024) throw new ErroApi(413, 'audio_grande', 'Áudio muito grande (máximo 10 MB).');

    let arquivo: unknown;
    try {
      arquivo = (await c.req.formData()).get('audio');
    } catch {
      throw requisicaoInvalida('Envie o áudio no campo "audio".');
    }
    if (!(arquivo instanceof File)) throw requisicaoInvalida('Envie o áudio no campo "audio".');
    if (arquivo.size > LIMITE_AUDIO_BYTES) throw new ErroApi(413, 'audio_grande', 'Áudio muito grande (máximo 10 MB).');
    if (arquivo.size === 0) throw requisicaoInvalida('Áudio vazio.');
    const tipo = arquivo.type.split(';')[0]!.trim().toLowerCase();
    if (!TIPOS_ACEITOS.test(tipo)) throw requisicaoInvalida('Formato de áudio não aceito.');

    const transcritor = deps.transcritor(c.env);
    if (!transcritor) throw new ErroApi(500, 'voz_indisponivel', 'Transcrição indisponível neste ambiente.');
    const inicio = Date.now();
    try {
      const texto = await transcritor.transcrever(await arquivo.arrayBuffer());
      // Log só com tipo, tamanho e tempo; nunca o conteúdo.
      console.log('voz ok', { tipo, bytes: arquivo.size, ms: Date.now() - inicio });
      return c.json({ texto });
    } catch (e) {
      console.error('voz falhou', { tipo, bytes: arquivo.size, ms: Date.now() - inicio, erro: e instanceof Error ? e.name : 'desconhecido' });
      throw new ErroApi(500, 'transcricao_falhou', 'Não entendi o áudio. Tenta de novo ou digita.');
    }
  });

  return rotas;
}
