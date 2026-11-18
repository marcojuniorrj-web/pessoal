import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Transcritor } from '../../adaptadores/voz/whisper';
import { criarAppTeste, entrar, URL_TESTE } from '../../../testes/ambiente';
import { criarTranscritorWhisper, MODELO_WHISPER } from '../../adaptadores/voz/whisper';
import { DURACAO_MAXIMA_MS, LIMITE_AUDIO_BYTES, LIMITE_TRANSCRICOES_DIA } from './rotas';
import { consumirTranscricao } from './repositorio';

function transcritorFalso(texto = 'amanhã preciso ligar para o cliente às dez') {
  const chamadas: number[] = [];
  const t: Transcritor = { transcrever: async (a) => (chamadas.push(a.byteLength), texto) };
  return { t, chamadas };
}

function formulario(bytes: number, tipo: string, nome = 'audio.m4a', duracaoMs?: string) {
  const f = new FormData();
  f.set('audio', new File([new Uint8Array(bytes).fill(1)], nome, { type: tipo }));
  if (duracaoMs !== undefined) f.set('duracao_ms', duracaoMs);
  return f;
}

const transcricoesDe = async (t: ReturnType<typeof criarAppTeste>, dia: string) =>
  (await t.env.DB.prepare('SELECT transcricoes AS n FROM uso_diario WHERE dia = ?').bind(dia).first<{ n: number }>())?.n ?? 0;

afterEach(() => vi.restoreAllMocks());

async function enviar(t: ReturnType<typeof criarAppTeste>, cookie: string, corpo: BodyInit) {
  return t.chamar('/api/voz', { method: 'POST', headers: { cookie, origin: URL_TESTE }, body: corpo });
}

describe('POST /api/voz', () => {
  it('sem sessão → 401', async () => {
    const t = criarAppTeste({ transcritor: transcritorFalso().t });
    const r = await t.chamar('/api/voz', { method: 'POST', headers: { origin: URL_TESTE }, body: formulario(10, 'audio/mp4') });
    expect(r.status).toBe(401);
  });

  it.each([
    'audio/mp4', 'audio/webm', 'audio/webm;codecs=opus', 'audio/webm; codecs=opus', 'AUDIO/MP4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg;codecs=opus',
    'audio/mpeg', 'audio/wav', 'video/mp4',
  ])('transcreve áudio %s', async (tipo) => {
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

describe('POST /api/voz: sessão, Origin e privacidade', () => {
  it('sem o cabeçalho Origin → 403 (como as demais escritas) e nada é contado', async () => {
    const { t, chamadas } = transcritorFalso();
    const app = criarAppTeste({ transcritor: t });
    const { cookie } = await entrar(app);
    const r = await app.chamar('/api/voz', { method: 'POST', headers: { cookie }, body: formulario(100, 'audio/mp4') });
    expect(r.status).toBe(403);
    expect(chamadas).toEqual([]);
  });

  it('os logs não levam o áudio nem o texto transcrito (só tipo, tamanho e tempo)', async () => {
    const texto = 'segredo-que-nao-pode-aparecer-no-log';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = criarAppTeste({ transcritor: transcritorFalso(texto).t });
    const { cookie } = await entrar(app);
    await enviar(app, cookie, formulario(2000, 'audio/webm;codecs=opus'));
    const falha = criarAppTeste({ transcritor: { transcrever: async () => { throw new Error(texto); } } });
    await enviar(falha, (await entrar(falha)).cookie, formulario(2000, 'audio/mp4'));
    const tudo = JSON.stringify([...log.mock.calls, ...erro.mock.calls, ...aviso.mock.calls]);
    expect(tudo).toContain('voz ok');
    expect(tudo).not.toContain(texto);
    expect(tudo).not.toContain('"bytes":[');
  });
});

describe('POST /api/voz: duração e formato', () => {
  it('duracao_ms até ~2 min passa; acima → 400 audio_longo; inválida → 400; ausente passa', async () => {
    const { t, chamadas } = transcritorFalso();
    const app = criarAppTeste({ transcritor: t });
    const { cookie } = await entrar(app);
    expect((await enviar(app, cookie, formulario(500, 'audio/mp4', 'a.m4a', '120000'))).status).toBe(200);
    expect((await enviar(app, cookie, formulario(500, 'audio/mp4', 'a.m4a', String(DURACAO_MAXIMA_MS)))).status).toBe(200);
    const longo = await enviar(app, cookie, formulario(500, 'audio/mp4', 'a.m4a', String(DURACAO_MAXIMA_MS + 1)));
    expect(longo.status).toBe(400);
    expect(((await longo.json()) as { erro: { codigo: string } }).erro.codigo).toBe('audio_longo');
    for (const ruim of ['abc', '-5', '1.5', '99999999999']) expect((await enviar(app, cookie, formulario(500, 'audio/mp4', 'a.m4a', ruim))).status, ruim).toBe(400);
    expect(chamadas).toHaveLength(2);
  });

  it('pedidos recusados (formato, tamanho, duração) não gastam o limite diário nem chamam o Whisper', async () => {
    const { t, chamadas } = transcritorFalso();
    const app = criarAppTeste({ transcritor: t });
    const { cookie } = await entrar(app);
    await enviar(app, cookie, formulario(100, 'image/png'));
    await enviar(app, cookie, formulario(0, 'audio/mp4'));
    await enviar(app, cookie, formulario(LIMITE_AUDIO_BYTES + 1, 'audio/mp4'));
    await enviar(app, cookie, formulario(100, 'audio/mp4', 'a.m4a', '999999'));
    expect(chamadas).toEqual([]);
    expect((await app.env.DB.prepare('SELECT COUNT(*) n FROM uso_diario').first<{ n: number }>())?.n).toBe(0);
  });
});

describe('POST /api/voz: limite de 60 transcrições por dia', () => {
  it('as 60 primeiras passam e a 61ª → 429 limite_voz, sem chamar o Whisper', async () => {
    const { t, chamadas } = transcritorFalso();
    const app = criarAppTeste({ transcritor: t, agora: () => new Date('2026-11-18T15:00:00Z') });
    const { cookie } = await entrar(app);
    for (let i = 0; i < LIMITE_TRANSCRICOES_DIA; i++) expect((await enviar(app, cookie, formulario(100, 'audio/mp4'))).status, `pedido ${i + 1}`).toBe(200);
    const r = await enviar(app, cookie, formulario(100, 'audio/mp4'));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ erro: { codigo: 'limite_voz', mensagem: 'Limite de voz de hoje atingido. Digite sua mensagem.' } });
    expect(chamadas).toHaveLength(LIMITE_TRANSCRICOES_DIA);
    // O pedido barrado não soma: o contador para em 60.
    expect(await transcricoesDe(app, '2026-11-18')).toBe(LIMITE_TRANSCRICOES_DIA);
  });

  it('a falha do Whisper conta (a contagem não volta)', async () => {
    const app = criarAppTeste({ transcritor: { transcrever: async () => { throw new Error('x'); } } });
    const { cookie } = await entrar(app);
    for (let i = 0; i < LIMITE_TRANSCRICOES_DIA; i++) expect((await enviar(app, cookie, formulario(100, 'audio/mp4'))).status).toBe(500);
    expect((await enviar(app, cookie, formulario(100, 'audio/mp4'))).status).toBe(429);
  });

  it('o dia é o dia local do Marco (fuso São Paulo) e o limite zera no dia seguinte', async () => {
    let agora = new Date('2026-11-18T02:30:00Z'); // 23:30 do dia 17 em São Paulo
    const { t, chamadas } = transcritorFalso();
    const app = criarAppTeste({ transcritor: t, agora: () => agora });
    const { cookie } = await entrar(app);
    await app.env.DB.prepare("INSERT INTO uso_diario (usuario_id, dia, respostas, transcricoes) SELECT id, '2026-11-17', 0, 60 FROM usuarios").run();
    expect((await enviar(app, cookie, formulario(100, 'audio/mp4'))).status).toBe(429); // ainda é 17/11 para o Marco
    agora = new Date('2026-11-18T03:30:00Z'); // 00:30 do dia 18 em São Paulo
    expect((await enviar(app, cookie, formulario(100, 'audio/mp4'))).status).toBe(200);
    expect(await transcricoesDe(app, '2026-11-18')).toBe(1);
    expect(await transcricoesDe(app, '2026-11-17')).toBe(60);
    expect(chamadas).toHaveLength(1);
  });

  it('convive com o limite de respostas (mesma linha de uso_diario): uma contagem não mexe na outra', async () => {
    const app = criarAppTeste({ transcritor: transcritorFalso().t, agora: () => new Date('2026-11-18T15:00:00Z') });
    const { cookie } = await entrar(app);
    await app.env.DB.prepare("INSERT INTO uso_diario (usuario_id, dia, respostas) SELECT id, '2026-11-18', 7 FROM usuarios").run();
    await enviar(app, cookie, formulario(100, 'audio/mp4'));
    const linha = await app.env.DB.prepare("SELECT respostas, transcricoes FROM uso_diario WHERE dia = '2026-11-18'").first<{ respostas: number; transcricoes: number }>();
    expect(linha).toEqual({ respostas: 7, transcricoes: 1 });
  });

  it('pedidos simultâneos não passam do limite', async () => {
    const { t, chamadas } = transcritorFalso();
    const app = criarAppTeste({ transcritor: t });
    const { cookie } = await entrar(app);
    const respostas = await Promise.all(Array.from({ length: LIMITE_TRANSCRICOES_DIA + 15 }, () => enviar(app, cookie, formulario(100, 'audio/mp4'))));
    expect(respostas.filter((r) => r.status === 200)).toHaveLength(LIMITE_TRANSCRICOES_DIA);
    expect(respostas.filter((r) => r.status === 429)).toHaveLength(15);
    expect(chamadas).toHaveLength(LIMITE_TRANSCRICOES_DIA);
  });

  it('o limite é por usuário: outro usuário no mesmo dia tem a própria contagem', async () => {
    const app = criarAppTeste();
    const db = app.env.DB;
    const agora = '2026-11-18T12:00:00.000Z';
    for (const id of ['u1', 'u2']) await db.prepare('INSERT INTO usuarios(id,email,nome,criado_em) VALUES(?,?,?,?)').bind(id, `${id}@x.com`, id, agora).run();
    for (let i = 0; i < 60; i++) expect(await consumirTranscricao(db, 'u1', '2026-11-18', 60)).toBe(true);
    expect(await consumirTranscricao(db, 'u1', '2026-11-18', 60)).toBe(false);
    expect(await consumirTranscricao(db, 'u2', '2026-11-18', 60)).toBe(true);
    expect(await consumirTranscricao(db, 'u1', '2026-11-19', 60)).toBe(true);
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
