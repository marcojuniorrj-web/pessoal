import { describe, expect, it } from 'vitest';
import {
  avisoDoEstado, DURACAO_MAXIMA_MS, DURACAO_MINIMA_MS, duracaoUtil, emAndamento, ehIos, escolherTipoAudio, ESTADO_INICIAL, formatarContador, nomeDoArquivo, reduzir,
  restanteMs, tempoAcabou, tipoDoArquivo, type EstadoGravacao, type EventoGravacao,
} from './gravacao';

const rodar = (eventos: EventoGravacao[], inicio: EstadoGravacao = ESTADO_INICIAL) => eventos.reduce(reduzir, inicio);
const gravando = (inicioMs = 1000, decorridoMs = 0): EstadoGravacao => ({ tipo: 'gravando', inicioMs, decorridoMs });

describe('contador regressivo', () => {
  it('formata m:ss arredondando para cima', () => {
    expect(formatarContador(120_000)).toBe('2:00');
    expect(formatarContador(119_999)).toBe('2:00');
    expect(formatarContador(119_000)).toBe('1:59');
    expect(formatarContador(61_000)).toBe('1:01');
    expect(formatarContador(60_000)).toBe('1:00');
    expect(formatarContador(59_001)).toBe('1:00');
    expect(formatarContador(9_000)).toBe('0:09');
    expect(formatarContador(1)).toBe('0:01');
    expect(formatarContador(0)).toBe('0:00');
    expect(formatarContador(-500)).toBe('0:00');
  });

  it('começa em 2:00 e desce um segundo por vez', () => {
    let e = rodar([{ tipo: 'tocou_microfone' }, { tipo: 'microfone_liberado', agoraMs: 5000 }]);
    expect(e).toEqual({ tipo: 'gravando', inicioMs: 5000, decorridoMs: 0 });
    expect(formatarContador(restanteMs(e))).toBe('2:00');
    e = reduzir(e, { tipo: 'tique', agoraMs: 5000 + 500 });
    expect(formatarContador(restanteMs(e))).toBe('2:00');
    e = reduzir(e, { tipo: 'tique', agoraMs: 5000 + 1000 });
    expect(formatarContador(restanteMs(e))).toBe('1:59');
    e = reduzir(e, { tipo: 'tique', agoraMs: 5000 + 61_500 });
    expect(formatarContador(restanteMs(e))).toBe('0:59');
    e = reduzir(e, { tipo: 'tique', agoraMs: 5000 + 119_000 });
    expect(formatarContador(restanteMs(e))).toBe('0:01');
    expect(tempoAcabou(e)).toBe(false);
  });

  it('aos 2:00 o tempo acaba (e não passa de zero, mesmo com o relógio atrasado)', () => {
    let e = gravando(0);
    e = reduzir(e, { tipo: 'tique', agoraMs: DURACAO_MAXIMA_MS });
    expect(formatarContador(restanteMs(e))).toBe('0:00');
    expect(tempoAcabou(e)).toBe(true);
    e = reduzir(gravando(0), { tipo: 'tique', agoraMs: DURACAO_MAXIMA_MS + 90_000 });
    expect(restanteMs(e)).toBe(0);
    expect(tempoAcabou(e)).toBe(true);
    // parar no fim vai à transcrição com no máximo 2:00
    expect(reduzir(e, { tipo: 'parou', agoraMs: DURACAO_MAXIMA_MS + 90_000 })).toEqual({ tipo: 'transcrevendo', duracaoMs: DURACAO_MAXIMA_MS });
  });

  it('o tique só troca o estado quando o número mostrado muda (evita renderizar a cada tique)', () => {
    const e = gravando(0);
    expect(reduzir(e, { tipo: 'tique', agoraMs: 200 })).toBe(e);
    expect(reduzir(e, { tipo: 'tique', agoraMs: 999 })).toBe(e);
    expect(reduzir(e, { tipo: 'tique', agoraMs: 1000 })).not.toBe(e);
  });

  it('relógio que volta atrás não gera contador acima de 2:00', () => {
    const e = reduzir(gravando(10_000), { tipo: 'tique', agoraMs: 5_000 });
    expect(formatarContador(restanteMs(e))).toBe('2:00');
  });

  it('fora da gravação o restante é 2:00', () => {
    expect(restanteMs(ESTADO_INICIAL)).toBe(DURACAO_MAXIMA_MS);
    expect(restanteMs({ tipo: 'transcrevendo', duracaoMs: 3000 })).toBe(DURACAO_MAXIMA_MS);
  });
});

describe('estados da gravação', () => {
  it('ocioso → preparando → gravando → transcrevendo → ocioso (texto enviado)', () => {
    let e = reduzir(ESTADO_INICIAL, { tipo: 'tocou_microfone' });
    expect(e.tipo).toBe('preparando');
    e = reduzir(e, { tipo: 'microfone_liberado', agoraMs: 0 });
    expect(e.tipo).toBe('gravando');
    e = reduzir(e, { tipo: 'parou', agoraMs: 3500 });
    expect(e).toEqual({ tipo: 'transcrevendo', duracaoMs: 3500 });
    expect(reduzir(e, { tipo: 'transcrito', texto: 'oi José' })).toEqual({ tipo: 'ocioso' });
  });

  it('áudio com menos de 1 s é descartado sem aviso', () => {
    expect(duracaoUtil(DURACAO_MINIMA_MS - 1)).toBe(false);
    expect(duracaoUtil(DURACAO_MINIMA_MS)).toBe(true);
    const e = reduzir(gravando(0), { tipo: 'parou', agoraMs: 999 });
    expect(e).toEqual({ tipo: 'ocioso' });
    expect(avisoDoEstado(e)).toBeNull();
    expect(reduzir(gravando(0), { tipo: 'parou', agoraMs: 1000 }).tipo).toBe('transcrevendo');
  });

  it('cancelar descarta: gravando, preparando ou transcrevendo → ocioso', () => {
    expect(reduzir(gravando(), { tipo: 'cancelou' })).toEqual({ tipo: 'ocioso' });
    expect(reduzir({ tipo: 'preparando' }, { tipo: 'cancelou' })).toEqual({ tipo: 'ocioso' });
    expect(reduzir({ tipo: 'transcrevendo', duracaoMs: 5000 }, { tipo: 'cancelou' })).toEqual({ tipo: 'ocioso' });
    expect(avisoDoEstado(reduzir(gravando(), { tipo: 'cancelou' }))).toBeNull();
  });

  it('microfone negado → negado, com a mensagem (e a instrução do iPhone)', () => {
    const e = rodar([{ tipo: 'tocou_microfone' }, { tipo: 'microfone_negado' }]);
    expect(e).toEqual({ tipo: 'negado' });
    expect(avisoDoEstado(e)).toBe('Libere o microfone nas configurações para usar voz.');
    const iphone = avisoDoEstado(e, { ios: true })!;
    expect(iphone).toContain('Libere o microfone nas configurações para usar voz.');
    expect(iphone).toContain('Ajustes > Safari');
    expect(iphone).toContain('Microfone');
  });

  it('sem microfone ou sem suporte → erro com aviso', () => {
    expect(rodar([{ tipo: 'tocou_microfone' }, { tipo: 'microfone_falhou' }])).toEqual({ tipo: 'erro', motivo: 'microfone' });
    expect(reduzir(ESTADO_INICIAL, { tipo: 'sem_suporte' })).toEqual({ tipo: 'erro', motivo: 'sem_suporte' });
    expect(avisoDoEstado({ tipo: 'erro', motivo: 'microfone' })).toMatch(/microfone/);
    expect(avisoDoEstado({ tipo: 'erro', motivo: 'sem_suporte' })).toMatch(/Digite/);
  });

  it.each([
    ['transcricao', 'Não entendi o áudio. Tenta de novo ou digita.'],
    ['limite', 'Limite de voz de hoje atingido. Digite sua mensagem.'],
    ['rede', 'Sem conexão. Tenta de novo ou digita.'],
  ] as const)('falha da transcrição (%s) → erro com o aviso certo', (motivo, aviso) => {
    const e = reduzir({ tipo: 'transcrevendo', duracaoMs: 2000 }, { tipo: 'transcricao_falhou', motivo });
    expect(e).toEqual({ tipo: 'erro', motivo });
    expect(avisoDoEstado(e)).toBe(aviso);
  });

  it('sessão expirada (401) não gera aviso: a sessão leva ao Login', () => {
    const e = reduzir({ tipo: 'transcrevendo', duracaoMs: 2000 }, { tipo: 'transcricao_falhou', motivo: 'sessao' });
    expect(e).toEqual({ tipo: 'erro', motivo: 'sessao' });
    expect(avisoDoEstado(e)).toBeNull();
  });

  it('transcrição vazia (ou só espaços) → erro "vazio" e nada é enviado', () => {
    for (const texto of ['', '   ', '\n']) {
      const e = reduzir({ tipo: 'transcrevendo', duracaoMs: 2000 }, { tipo: 'transcrito', texto });
      expect(e).toEqual({ tipo: 'erro', motivo: 'vazio' });
    }
    expect(avisoDoEstado({ tipo: 'erro', motivo: 'vazio' })).toBe('Não ouvi nada no áudio. Tenta de novo ou digita.');
  });

  it('app saiu da tela: gravando ou preparando → erro com o aviso; transcrevendo continua', () => {
    expect(reduzir(gravando(), { tipo: 'saiu_da_tela' })).toEqual({ tipo: 'erro', motivo: 'saiu_da_tela' });
    expect(reduzir({ tipo: 'preparando' }, { tipo: 'saiu_da_tela' })).toEqual({ tipo: 'erro', motivo: 'saiu_da_tela' });
    expect(avisoDoEstado({ tipo: 'erro', motivo: 'saiu_da_tela' })).toBe('Gravação cancelada (o app saiu da tela)');
    const t: EstadoGravacao = { tipo: 'transcrevendo', duracaoMs: 3000 };
    expect(reduzir(t, { tipo: 'saiu_da_tela' })).toBe(t);
  });

  it('de erro ou negado dá para tocar no 🎤 de novo', () => {
    expect(reduzir({ tipo: 'erro', motivo: 'transcricao' }, { tipo: 'tocou_microfone' }).tipo).toBe('preparando');
    expect(reduzir({ tipo: 'negado' }, { tipo: 'tocou_microfone' }).tipo).toBe('preparando');
  });

  it('eventos fora de hora são ignorados (toque duplo, tique atrasado, resposta tardia)', () => {
    const g = gravando();
    expect(reduzir(g, { tipo: 'tocou_microfone' })).toBe(g);
    const t: EstadoGravacao = { tipo: 'transcrevendo', duracaoMs: 3000 };
    expect(reduzir(t, { tipo: 'tocou_microfone' })).toBe(t);
    expect(reduzir(t, { tipo: 'tique', agoraMs: 10 })).toBe(t);
    expect(reduzir(t, { tipo: 'parou', agoraMs: 10 })).toBe(t);
    expect(reduzir(ESTADO_INICIAL, { tipo: 'parou', agoraMs: 10 })).toBe(ESTADO_INICIAL);
    expect(reduzir(ESTADO_INICIAL, { tipo: 'transcrito', texto: 'oi' })).toBe(ESTADO_INICIAL);
    expect(reduzir(ESTADO_INICIAL, { tipo: 'microfone_liberado', agoraMs: 0 })).toBe(ESTADO_INICIAL);
    const erro: EstadoGravacao = { tipo: 'erro', motivo: 'vazio' };
    expect(reduzir(erro, { tipo: 'cancelou' })).toBe(erro);
  });

  it('emAndamento vale para preparando, gravando e transcrevendo', () => {
    expect([ESTADO_INICIAL, { tipo: 'preparando' }, gravando(), { tipo: 'transcrevendo', duracaoMs: 1 }, { tipo: 'erro', motivo: 'vazio' }, { tipo: 'negado' }].map((e) => emAndamento(e as EstadoGravacao))).toEqual([
      false, true, true, true, false, false,
    ]);
  });
});

describe('formato do áudio', () => {
  const suporta = (...tipos: string[]) => (t: string) => tipos.includes(t);
  it('iPhone: audio/mp4 primeiro, mesmo que o Safari também grave webm', () => {
    expect(escolherTipoAudio(suporta('audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'), true)).toBe('audio/mp4');
    expect(escolherTipoAudio(suporta('audio/webm;codecs=opus'), true)).toBe('audio/webm;codecs=opus');
  });
  it('Android e computador: webm/opus primeiro, mesmo que o Chrome também grave mp4', () => {
    expect(escolherTipoAudio(suporta('audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'), false)).toBe('audio/webm;codecs=opus');
    expect(escolherTipoAudio(suporta('audio/webm'), false)).toBe('audio/webm');
    expect(escolherTipoAudio(suporta('audio/ogg;codecs=opus', 'audio/mp4'), false)).toBe('audio/ogg;codecs=opus');
    expect(escolherTipoAudio(suporta('audio/mp4'), false)).toBe('audio/mp4');
  });
  it('nenhum suportado → vazio (o navegador escolhe)', () => {
    expect(escolherTipoAudio(() => false, true)).toBe('');
  });
  it('reconhece iPhone, iPad e iPad que se apresenta como Mac', () => {
    expect(ehIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(true);
    expect(ehIos('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(ehIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(ehIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
    expect(ehIos('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0')).toBe(false);
  });
  it('tipo do arquivo: o do gravador, senão o escolhido, senão um padrão pela plataforma', () => {
    expect(tipoDoArquivo('audio/mp4', 'audio/webm', false)).toBe('audio/mp4');
    expect(tipoDoArquivo('', 'audio/webm;codecs=opus', true)).toBe('audio/webm;codecs=opus');
    expect(tipoDoArquivo('', '', true)).toBe('audio/mp4');
    expect(tipoDoArquivo('', '', false)).toBe('audio/webm');
  });
  it('nome do arquivo pelo tipo (com parâmetros)', () => {
    expect(nomeDoArquivo('audio/mp4')).toBe('audio.m4a');
    expect(nomeDoArquivo('audio/webm;codecs=opus')).toBe('audio.webm');
    expect(nomeDoArquivo('audio/ogg;codecs=opus')).toBe('audio.ogg');
    expect(nomeDoArquivo('audio/x-m4a')).toBe('audio.m4a');
    expect(nomeDoArquivo('audio/wav')).toBe('audio.wav');
    expect(nomeDoArquivo('audio/mpeg')).toBe('audio.mp3');
  });
});
