import { describe, expect, it } from 'vitest';
import type { Transcritor } from '../../adaptadores/voz/whisper';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';
import { criarTranscritorWhisper, MODELO_WHISPER } from '../../adaptadores/voz/whisper';
import { LIMITE_AUDIO_BYTES } from './rotas';

function transcritorFalso(texto = 'amanhã preciso ligar para o cliente às dez') {
  const chamadas: number[] = [];
  const t: Transcritor = { transcrever: async (a) => (chamadas.push(a.byteLength), texto) };
  return { t, chamadas };
}

function formulario(bytes: number, tipo: string, nome = 'audio.m4a') {
  const f = new FormData();
  f.set('audio', new File([new Uint8Array(bytes).fill(1)], nome, { type: tipo }));
  return f;
}

async function enviar(t: ReturnType<typeof criarAppTeste>, cookie: string, corpo: BodyInit) {
  return t.chamar('/api/voz', { method: 'POST', headers: { cookie, origin: URL_TESTE }, body: corpo });
}

describe('POST /api/voz', () => {
  it('sem sessão → 401', async () => {
    const t = criarAppTeste({ transcritor: transcritorFalso().t });
    const r = await t.chamar('/api/voz', { method: 'POST', headers: { origin: URL_TESTE }, body: formulario(10, 'audio/mp4') });
    expect(r.status).toBe(401);
  });

  it.each(['audio/mp4', 'audio/webm;codecs=opus', 'audio/x-m4a', 'video/mp4'])('transcreve áudio %s', async (tipo) => {
    const { t, chamadas } = transcritorFalso();
    const app = criarAppTeste({ transcritor: t });
    const { cookie } = await entrar(app);
    const r = await enviar(app, cookie, formulario(2000, tipo));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ texto: 'amanhã preciso ligar para o cliente às dez' });
    expect(chamadas).toEqual([2000]);
  });

  it('descarta o áudio: nada é gravado no banco', async () => {
    const app = criarAppTeste({ transcritor: transcritorFalso().t });
    const { cookie } = await entrar(app);
    const antes = await app.env.DB.prepare('SELECT COUNT(*) n FROM mensagens').first<{ n: number }>();
    await enviar(app, cookie, formulario(2000, 'audio/mp4'));
    const depois = await app.env.DB.prepare('SELECT COUNT(*) n FROM mensagens').first<{ n: number }>();
    expect(depois?.n).toBe(antes?.n);
  });

  it('acima de 10 MB → 413', async () => {
    const { t, chamadas } = transcritorFalso();
    const app = criarAppTeste({ transcritor: t });
    const { cookie } = await entrar(app);
    const r = await enviar(app, cookie, formulario(LIMITE_AUDIO_BYTES + 1, 'audio/mp4'));
    expect(r.status).toBe(413);
    expect(chamadas).toEqual([]);
  });

  it('formato inválido, campo ausente ou vazio → 400', async () => {
    const app = criarAppTeste({ transcritor: transcritorFalso().t });
    const { cookie } = await entrar(app);
    expect((await enviar(app, cookie, formulario(100, 'image/png'))).status).toBe(400);
    expect((await enviar(app, cookie, new FormData())).status).toBe(400);
    expect((await enviar(app, cookie, formulario(0, 'audio/mp4'))).status).toBe(400);
  });

  it('falha do provedor → 500 com mensagem amigável e sem vazar detalhes', async () => {
    const app = criarAppTeste({ transcritor: { transcrever: async () => { throw new Error('boom secreto'); } } });
    const { cookie } = await entrar(app);
    const r = await enviar(app, cookie, formulario(100, 'audio/mp4'));
    expect(r.status).toBe(500);
    const j = (await r.json()) as { erro: { mensagem: string } };
    expect(j.erro.mensagem).toBe('Não entendi o áudio. Tenta de novo ou digita.');
  });

  it('sem Workers AI no ambiente → erro claro', async () => {
    const app = criarAppTeste();
    const { cookie } = await entrar(app);
    const r = await enviar(app, cookie, formulario(100, 'audio/mp4'));
    expect(r.status).toBe(500);
    expect(((await r.json()) as { erro: { codigo: string } }).erro.codigo).toBe('voz_indisponivel');
  });
});

describe('adaptador Whisper', () => {
  it('chama o modelo turbo com idioma pt e áudio em base64', async () => {
    let recebido: { modelo?: string; entrada?: { audio: string; language: string } } = {};
    const ai = { run: async (modelo: string, entrada: { audio: string; language: string }) => ((recebido = { modelo, entrada }), { text: '  olá  ' }) } as unknown as Ai;
    const texto = await criarTranscritorWhisper(ai).transcrever(new Uint8Array([1, 2, 3]).buffer);
    expect(texto).toBe('olá');
    expect(recebido.modelo).toBe(MODELO_WHISPER);
    expect(recebido.entrada).toEqual({ audio: btoa('\x01\x02\x03'), language: 'pt' });
  });
});
