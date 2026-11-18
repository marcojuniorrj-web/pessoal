import { afterEach, describe, expect, it, vi } from 'vitest';
import { plataformaDoNavegador } from './gravador-voz';
import { escolherTipoAudio } from './gravacao';

const fluxo = {} as MediaStream;

afterEach(() => vi.unstubAllGlobals());

describe('plataformaDoNavegador: formato de áudio do MediaRecorder', () => {
  it('sem MediaRecorder.isTypeSupported, nenhum formato é "suportado" e a gravação segue no padrão do navegador', () => {
    class SemSuporte {
      constructor(public fluxo: MediaStream, public opcoes?: { mimeType?: string }) {}
    }
    vi.stubGlobal('MediaRecorder', SemSuporte);
    const p = plataformaDoNavegador();
    expect(p.tipoSuportado('audio/mp4')).toBe(false);
    const tipo = escolherTipoAudio(p.tipoSuportado, true);
    expect(tipo).toBe('');
    const g = p.criarGravador(fluxo, tipo) as unknown as SemSuporte;
    expect(g.opcoes).toBeUndefined();
  });

  it('com isTypeSupported, usa o resultado dele', () => {
    class Com {
      static isTypeSupported = (t: string) => t === 'audio/mp4';
    }
    vi.stubGlobal('MediaRecorder', Com);
    const p = plataformaDoNavegador();
    expect(p.tipoSuportado('audio/mp4')).toBe(true);
    expect(p.tipoSuportado('audio/webm')).toBe(false);
  });

  it('se o navegador recusa o formato escolhido (NotSupportedError), tenta de novo sem formato', () => {
    const chamadas: Array<{ mimeType?: string } | undefined> = [];
    class Recusa {
      constructor(_f: MediaStream, opcoes?: { mimeType?: string }) {
        chamadas.push(opcoes);
        if (opcoes?.mimeType) throw new DOMException('formato recusado', 'NotSupportedError');
      }
    }
    vi.stubGlobal('MediaRecorder', Recusa);
    const g = plataformaDoNavegador().criarGravador(fluxo, 'audio/mp4');
    expect(g).toBeInstanceOf(Recusa);
    expect(chamadas).toEqual([{ mimeType: 'audio/mp4' }, undefined]);
  });

  it('formato aceito: uma única tentativa, com o formato', () => {
    const chamadas: Array<{ mimeType?: string } | undefined> = [];
    class Aceita {
      constructor(_f: MediaStream, opcoes?: { mimeType?: string }) {
        chamadas.push(opcoes);
      }
    }
    vi.stubGlobal('MediaRecorder', Aceita);
    plataformaDoNavegador().criarGravador(fluxo, 'audio/webm;codecs=opus');
    expect(chamadas).toEqual([{ mimeType: 'audio/webm;codecs=opus' }]);
  });
});
