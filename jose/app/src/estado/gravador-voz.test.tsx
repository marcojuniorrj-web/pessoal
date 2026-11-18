// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroHttp, ErroRede } from '../api/cliente';
import { formatarContador } from './gravacao';
import { useGravadorVoz, type PlataformaVoz } from './gravador-voz';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- dublês do navegador ----
class FaixaFalsa {
  readyState: 'live' | 'ended' = 'live';
  stop = vi.fn(() => {
    this.readyState = 'ended';
  });
}
class FluxoFalso {
  faixas = [new FaixaFalsa(), new FaixaFalsa()];
  getTracks() {
    return this.faixas as unknown as MediaStreamTrack[];
  }
  get solto() {
    return this.faixas.every((f) => f.readyState === 'ended');
  }
}
class GravadorFalso {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  /** O onstop do navegador é assíncrono: o teste decide quando ele chega. */
  paradasPendentes: Array<() => void> = [];
  constructor(readonly tipo: string) {
    this.mimeType = tipo;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    if (this.state === 'inactive') throw new Error('InvalidStateError');
    this.state = 'inactive';
    this.paradasPendentes.push(() => {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(2048)], { type: this.mimeType }) });
      this.onstop?.();
    });
  }
  concluirParada() {
    this.paradasPendentes.splice(0).forEach((f) => f());
  }
}

interface Ambiente {
  fluxo: FluxoFalso;
  gravadores: GravadorFalso[];
  pedirMicrofone: ReturnType<typeof vi.fn>;
  transcrever: ReturnType<typeof vi.fn>;
  plataforma: PlataformaVoz;
  visivel: boolean;
}
function criarAmbiente(extra: { suporte?: boolean; ios?: boolean; pedir?: () => Promise<MediaStream> } = {}): Ambiente {
  const fluxo = new FluxoFalso();
  const gravadores: GravadorFalso[] = [];
  const amb = { fluxo, gravadores, visivel: true } as Ambiente;
  amb.pedirMicrofone = vi.fn(extra.pedir ?? (async () => fluxo as unknown as MediaStream));
  amb.transcrever = vi.fn(async () => 'preciso organizar a visita do cliente');
  amb.plataforma = {
    temSuporte: () => extra.suporte ?? true,
    pedirMicrofone: amb.pedirMicrofone as never,
    criarGravador: (_f, tipo) => {
      const g = new GravadorFalso(tipo);
      gravadores.push(g);
      return g as unknown as MediaRecorder;
    },
    tipoSuportado: (t) => ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].includes(t),
    ios: () => extra.ios ?? false,
    agora: () => Date.now(),
    visivel: () => amb.visivel,
    transcrever: amb.transcrever as never,
  };
  return amb;
}

// ---- harness ----
let raiz: Root;
let contenedor: HTMLElement;
type Voz = ReturnType<typeof useGravadorVoz>;
let voz: Voz;
let textos: string[];
let avisos: string[];

function Harness({ plataforma }: { plataforma: PlataformaVoz }) {
  voz = useGravadorVoz({ aoTexto: (t) => textos.push(t), aoAvisar: (m) => avisos.push(m), plataforma });
  return null;
}
const montar = (amb: Ambiente) => act(() => raiz.render(<Harness plataforma={amb.plataforma} />));
const avancar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const iniciar = () => act(async () => { await voz.iniciar(); });
const parar = () => act(async () => { voz.parar(); });
const cancelar = () => act(async () => { voz.cancelar(); });
const concluirParada = (amb: Ambiente) => act(async () => { amb.gravadores.at(-1)!.concluirParada(); await Promise.resolve(); });
const esconderApp = (amb: Ambiente) => act(async () => {
  amb.visivel = false;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});

beforeEach(() => {
  vi.useFakeTimers();
  textos = [];
  avisos = [];
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
});
afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  vi.useRealTimers();
});

describe('useGravadorVoz', () => {
  it('toque grava, toque para: transcreve com o tipo e a duração, entrega o texto e solta o microfone', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await iniciar();
    expect(voz.estado.tipo).toBe('gravando');
    expect(formatarContador(voz.restanteMs)).toBe('2:00');
    expect(amb.gravadores[0]!.tipo).toBe('audio/webm;codecs=opus'); // Android/computador
    await avancar(5000);
    expect(formatarContador(voz.restanteMs)).toBe('1:55');
    await parar();
    expect(voz.estado).toMatchObject({ tipo: 'transcrevendo' });
    await concluirParada(amb);
    expect(amb.fluxo.solto).toBe(true);
    expect(amb.transcrever).toHaveBeenCalledTimes(1);
    const [audio, duracao] = amb.transcrever.mock.calls[0]! as [Blob, number];
    expect(audio.type).toBe('audio/webm;codecs=opus');
    expect(audio.size).toBe(2048);
    expect(duracao).toBe(5000);
    expect(textos).toEqual(['preciso organizar a visita do cliente']);
    expect(voz.estado.tipo).toBe('ocioso');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('iPhone grava audio/mp4', async () => {
    const amb = criarAmbiente({ ios: true });
    montar(amb);
    await iniciar();
    expect(amb.gravadores[0]!.tipo).toBe('audio/mp4');
    await avancar(2000);
    await parar();
    await concluirParada(amb);
    expect((amb.transcrever.mock.calls[0]![0] as Blob).type).toBe('audio/mp4');
  });

  it('menos de 1 s: descarta sem aviso, nada é transcrito e o microfone é solto', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await iniciar();
    await avancar(600);
    await parar();
    expect(voz.estado.tipo).toBe('ocioso');
    await concluirParada(amb);
    expect(amb.fluxo.solto).toBe(true);
    expect(amb.transcrever).not.toHaveBeenCalled();
    expect(textos).toEqual([]);
    expect(avisos).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('✕ cancela: nada é transcrito (mesmo que o gravador ainda entregue o arquivo) e o microfone é solto na hora', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await iniciar();
    await avancar(3000);
    await cancelar();
    expect(voz.estado.tipo).toBe('ocioso');
    expect(amb.fluxo.solto).toBe(true); // sem esperar o onstop
    await concluirParada(amb);
    expect(amb.transcrever).not.toHaveBeenCalled();
    expect(textos).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aos 2:00 para sozinho e envia', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await iniciar();
    await avancar(119_000);
    expect(voz.estado.tipo).toBe('gravando');
    expect(formatarContador(voz.restanteMs)).toBe('0:01');
    await avancar(1000);
    expect(voz.estado.tipo).toBe('transcrevendo');
    await concluirParada(amb);
    expect(amb.fluxo.solto).toBe(true);
    expect((amb.transcrever.mock.calls[0]! as [Blob, number])[1]).toBe(120_000);
    expect(textos).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('toque duplo no 🎤 não abre dois microfones', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await act(async () => { void voz.iniciar(); void voz.iniciar(); });
    expect(amb.pedirMicrofone).toHaveBeenCalledTimes(1);
    expect(amb.gravadores).toHaveLength(1);
  });

  it('microfone negado → estado negado', async () => {
    const amb = criarAmbiente({ pedir: async () => { throw new DOMException('negado', 'NotAllowedError'); } });
    montar(amb);
    await iniciar();
    expect(voz.estado.tipo).toBe('negado');
    expect(amb.gravadores).toHaveLength(0);
  });

  it('sem microfone (NotFoundError) → erro "microfone"; sem suporte → erro "sem_suporte"', async () => {
    const amb = criarAmbiente({ pedir: async () => { throw new DOMException('x', 'NotFoundError'); } });
    montar(amb);
    await iniciar();
    expect(voz.estado).toEqual({ tipo: 'erro', motivo: 'microfone' });
    const sem = criarAmbiente({ suporte: false });
    montar(sem);
    await iniciar();
    expect(voz.estado).toEqual({ tipo: 'erro', motivo: 'sem_suporte' });
    expect(sem.pedirMicrofone).not.toHaveBeenCalled();
  });

  it('falhas da transcrição: erro genérico, limite (429), rede e sessão (401)', async () => {
    const casos: Array<[unknown, string]> = [
      [new Error('boom'), 'transcricao'],
      [new ErroHttp(500, 'transcricao_falhou', 'x'), 'transcricao'],
      [new ErroHttp(429, 'limite_voz', 'x'), 'limite'],
      [new ErroRede(), 'rede'],
      [new ErroHttp(401, 'nao_autenticado', 'x'), 'sessao'],
    ];
    for (const [erro, motivo] of casos) {
      const amb = criarAmbiente();
      amb.transcrever.mockRejectedValueOnce(erro);
      montar(amb);
      await iniciar();
      await avancar(2000);
      await parar();
      await concluirParada(amb);
      expect(voz.estado, motivo).toEqual({ tipo: 'erro', motivo });
      expect(amb.fluxo.solto).toBe(true);
      expect(textos).toEqual([]);
      act(() => raiz.render(null));
    }
  });

  it('transcrição vazia → erro "vazio", nada é enviado; dá para gravar de novo', async () => {
    const amb = criarAmbiente();
    amb.transcrever.mockResolvedValueOnce('   ');
    montar(amb);
    await iniciar();
    await avancar(2000);
    await parar();
    await concluirParada(amb);
    expect(voz.estado).toEqual({ tipo: 'erro', motivo: 'vazio' });
    expect(textos).toEqual([]);
    await iniciar();
    expect(voz.estado.tipo).toBe('gravando');
  });

  it('app vai para o segundo plano durante a gravação: cancela, solta o microfone, não envia e avisa', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await iniciar();
    await avancar(4000);
    await esconderApp(amb);
    expect(voz.estado).toEqual({ tipo: 'erro', motivo: 'saiu_da_tela' });
    expect(amb.fluxo.solto).toBe(true);
    await concluirParada(amb);
    expect(amb.transcrever).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('o app escondeu enquanto o aparelho pedia a permissão: não grava escondido', async () => {
    let liberar!: (f: MediaStream) => void;
    const amb = criarAmbiente({ pedir: () => new Promise<MediaStream>((r) => (liberar = r)) });
    montar(amb);
    await act(async () => { void voz.iniciar(); });
    expect(voz.estado.tipo).toBe('preparando');
    amb.visivel = false;
    await act(async () => liberar(amb.fluxo as unknown as MediaStream));
    expect(voz.estado).toEqual({ tipo: 'erro', motivo: 'saiu_da_tela' });
    expect(amb.fluxo.solto).toBe(true);
    expect(amb.gravadores).toHaveLength(0);
  });

  it('cancelar enquanto o aparelho pede a permissão: ao liberar, o microfone é solto e não grava', async () => {
    let liberar!: (f: MediaStream) => void;
    const amb = criarAmbiente({ pedir: () => new Promise<MediaStream>((r) => (liberar = r)) });
    montar(amb);
    await act(async () => { void voz.iniciar(); });
    await cancelar();
    expect(voz.estado.tipo).toBe('ocioso');
    await act(async () => liberar(amb.fluxo as unknown as MediaStream));
    expect(amb.fluxo.solto).toBe(true);
    expect(amb.gravadores).toHaveLength(0);
    expect(voz.estado.tipo).toBe('ocioso');
  });

  it('desmontar (trocar de aba/rota) durante a gravação: solta o microfone, não envia e avisa', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await iniciar();
    await avancar(3000);
    act(() => raiz.render(null));
    expect(amb.fluxo.solto).toBe(true);
    expect(avisos).toEqual(['Gravação cancelada.']);
    await act(async () => { amb.gravadores[0]!.concluirParada(); });
    expect(amb.transcrever).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('desmontar durante a transcrição: o pedido é abortado e o texto não é entregue', async () => {
    const amb = criarAmbiente();
    let sinal: AbortSignal | undefined;
    amb.transcrever.mockImplementation(async (_a: Blob, _d: number, s?: AbortSignal) => {
      sinal = s;
      return new Promise<string>((resolve) => setTimeout(() => resolve('texto tardio'), 5000));
    });
    montar(amb);
    await iniciar();
    await avancar(2000);
    await parar();
    await concluirParada(amb);
    expect(voz.estado.tipo).toBe('transcrevendo');
    act(() => raiz.render(null));
    expect(sinal?.aborted).toBe(true);
    await avancar(6000);
    expect(textos).toEqual([]);
  });

  it('se o gravador nunca avisar que parou, a transcrição falha em 5 s em vez de ficar carregando', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await iniciar();
    await avancar(2000);
    await parar();
    expect(voz.estado.tipo).toBe('transcrevendo');
    await avancar(5000);
    expect(voz.estado).toEqual({ tipo: 'erro', motivo: 'transcricao' });
    expect(amb.fluxo.solto).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancelarTudo (troca de conversa) cancela gravação e transcrição', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await iniciar();
    await avancar(2000);
    await act(async () => voz.cancelarTudo('Gravação cancelada.'));
    expect(voz.estado.tipo).toBe('ocioso');
    expect(amb.fluxo.solto).toBe(true);
    expect(avisos).toEqual(['Gravação cancelada.']);
  });

  it('erro do gravador no meio da gravação: cancela, solta o microfone e avisa', async () => {
    const amb = criarAmbiente();
    montar(amb);
    await iniciar();
    await act(async () => amb.gravadores[0]!.onerror?.());
    expect(voz.estado.tipo).toBe('ocioso');
    expect(amb.fluxo.solto).toBe(true);
    expect(avisos).toEqual(['Não foi possível gravar o áudio.']);
  });
});
