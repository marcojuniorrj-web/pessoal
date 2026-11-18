import { describe, expect, it } from 'vitest';
import { calcularTeclado } from './teclado';

const base = { alturaJanela: 800, alturaVisivel: 800, escala: 1, deslocamentoTopo: 0, campoEmFoco: false };

describe('calcularTeclado', () => {
  it('tela normal: teclado fechado', () => {
    expect(calcularTeclado(base)).toEqual({ aberto: false, altura: null, topo: 0 });
  });
  it('teclado de verdade: campo em foco e altura visível bem menor', () => {
    expect(calcularTeclado({ ...base, alturaVisivel: 480, campoEmFoco: true, deslocamentoTopo: 24 })).toEqual({
      aberto: true, altura: 480, topo: 24,
    });
  });
  it('ZOOM no iPhone não conta como teclado (a barra de abas continua)', () => {
    expect(calcularTeclado({ ...base, alturaVisivel: 400, escala: 2 }).aberto).toBe(false);
    expect(calcularTeclado({ ...base, alturaVisivel: 400, escala: 2, campoEmFoco: true }).aberto).toBe(false);
  });
  it('altura visível menor SEM campo em foco não é teclado', () => {
    expect(calcularTeclado({ ...base, alturaVisivel: 480 }).aberto).toBe(false);
  });
  it('diferença pequena (barra do navegador) não é teclado', () => {
    expect(calcularTeclado({ ...base, alturaVisivel: 740, campoEmFoco: true }).aberto).toBe(false);
  });
  it('deslocamento negativo vira 0', () => {
    expect(calcularTeclado({ ...base, alturaVisivel: 480, campoEmFoco: true, deslocamentoTopo: -5 }).topo).toBe(0);
  });
});
