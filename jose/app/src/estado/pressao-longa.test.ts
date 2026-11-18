import { describe, expect, it, vi } from 'vitest';
import { criarPressaoLonga, TEMPO_PRESSAO_MS, TOLERANCIA_MOVIMENTO_PX } from './pressao-longa';

function montar() {
  vi.useFakeTimers();
  const eventos: string[] = [];
  const p = criarPressaoLonga({
    aoDisparar: () => eventos.push('disparou'),
    aoComecar: () => eventos.push('comecou'),
    aoTerminar: () => eventos.push('terminou'),
  });
  return { p, eventos };
}

describe('pressão longa', () => {
  it('usa ~450 ms e ~10 px', () => {
    expect(TEMPO_PRESSAO_MS).toBe(450);
    expect(TOLERANCIA_MOVIMENTO_PX).toBe(10);
  });

  it('dispara uma vez depois do tempo, parado', () => {
    const { p, eventos } = montar();
    p.iniciar(100, 100);
    vi.advanceTimersByTime(TEMPO_PRESSAO_MS - 1);
    expect(eventos).toEqual(['comecou']);
    vi.advanceTimersByTime(1);
    expect(eventos).toEqual(['comecou', 'disparou']);
    expect(p.disparou).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(eventos.filter((e) => e === 'disparou')).toHaveLength(1);
    p.terminar();
    expect(eventos.at(-1)).toBe('terminou');
    vi.useRealTimers();
  });

  it('soltar antes do tempo cancela', () => {
    const { p, eventos } = montar();
    p.iniciar(0, 0);
    vi.advanceTimersByTime(300);
    p.terminar();
    vi.advanceTimersByTime(1000);
    expect(eventos).toEqual(['comecou', 'terminou']);
    expect(p.disparou).toBe(false);
    vi.useRealTimers();
  });

  it('movimento maior que a tolerância cancela (rolagem); até a tolerância, não', () => {
    const { p, eventos } = montar();
    p.iniciar(100, 100);
    p.mover(103, 106); // ~6,7 px
    p.mover(100, 110); // exatamente 10 px: ainda vale
    vi.advanceTimersByTime(TEMPO_PRESSAO_MS);
    expect(eventos).toEqual(['comecou', 'disparou']);
    p.terminar();

    const outro = montar();
    outro.p.iniciar(100, 100);
    outro.p.mover(100, 111); // 11 px
    vi.advanceTimersByTime(2000);
    expect(outro.eventos).toEqual(['comecou', 'terminou']);
    vi.useRealTimers();
  });

  it('a tolerância conta a distância desde o ponto inicial (diagonal)', () => {
    const { p, eventos } = montar();
    p.iniciar(0, 0);
    p.mover(8, 8); // ~11,3 px
    vi.advanceTimersByTime(2000);
    expect(eventos).toEqual(['comecou', 'terminou']);
    vi.useRealTimers();
  });

  it('movimento depois de disparar não cancela nada, e uma nova pressão recomeça do zero', () => {
    const { p, eventos } = montar();
    p.iniciar(0, 0);
    vi.advanceTimersByTime(TEMPO_PRESSAO_MS);
    p.mover(200, 200);
    expect(eventos).toEqual(['comecou', 'disparou']);
    p.terminar();
    p.iniciar(0, 0);
    expect(p.disparou).toBe(false);
    vi.advanceTimersByTime(TEMPO_PRESSAO_MS);
    expect(eventos.filter((e) => e === 'disparou')).toHaveLength(2);
    vi.useRealTimers();
  });

  it('terminar sem pressão em andamento não faz nada', () => {
    const { p, eventos } = montar();
    p.terminar();
    p.mover(5, 5);
    expect(eventos).toEqual([]);
    vi.useRealTimers();
  });
});
