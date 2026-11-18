import { describe, expect, it } from 'vitest';
import { comTransbordo, foraDaLargura, menoresQue, sobrepoe, type Caixa, type Conteudo } from './medidas';

const c = (x: number, y: number, width: number, height = 10, rotulo = 'c'): Caixa => ({ rotulo, x, y, width, height });

describe('foraDaLargura', () => {
  it('aceita o que cabe e aponta o que passa (direita ou esquerda), com meio pixel de tolerância', () => {
    expect(foraDaLargura([c(0, 0, 320), c(16, 0, 288), c(10, 0, 310.4)], 320)).toEqual([]);
    expect(foraDaLargura([c(0, 0, 321, 10, 'larga'), c(-2, 0, 50, 10, 'esquerda'), c(300, 0, 40, 10, 'direita')], 320).map((x) => x.rotulo)).toEqual(['larga', 'esquerda', 'direita']);
  });
});

describe('sobrepoe', () => {
  it('detecta sobreposição real e ignora encostar na borda', () => {
    expect(sobrepoe(c(0, 0, 100, 50), c(50, 25, 100, 50))).toBe(true);
    expect(sobrepoe(c(0, 0, 100, 50), c(100, 0, 100, 50))).toBe(false); // lado a lado
    expect(sobrepoe(c(0, 0, 100, 50), c(0, 50, 100, 50))).toBe(false); // um sobre o outro
    expect(sobrepoe(c(0, 0, 100, 50), c(200, 200, 10, 10))).toBe(false);
    expect(sobrepoe(c(10, 10, 20, 20), c(0, 0, 100, 100))).toBe(true); // um dentro do outro
  });
});

describe('menoresQue (alvos de toque)', () => {
  it('aponta alvos com menos de 48px em altura ou largura', () => {
    expect(menoresQue([c(0, 0, 48, 48), c(0, 0, 120, 48.2)])).toEqual([]);
    expect(menoresQue([c(0, 0, 47, 48, 'estreito'), c(0, 0, 100, 40, 'baixo')]).map((x) => x.rotulo)).toEqual(['estreito', 'baixo']);
  });
});

describe('comTransbordo (texto que vaza da própria caixa)', () => {
  const i = (scrollWidth: number, clientWidth: number, extra: Partial<Conteudo> = {}): Conteudo => ({ rotulo: 'p', scrollWidth, clientWidth, overflowX: 'visible', textOverflow: 'clip', ...extra });
  it('aponta palavra longa que vaza, ignora o que cabe e a folga de 1px', () => {
    expect(comTransbordo([i(960, 262, { rotulo: 'vaza' }), i(262, 262), i(263, 262)]).map((x) => x.rotulo)).toEqual(['vaza']);
  });
  it('não conta truncar de propósito (reticências, hidden, clip), mas conta contêiner com rolagem lateral', () => {
    expect(comTransbordo([i(900, 200, { textOverflow: 'ellipsis' }), i(900, 200, { overflowX: 'hidden' }), i(900, 200, { overflowX: 'clip' })])).toEqual([]);
    expect(comTransbordo([i(900, 358, { overflowX: 'auto', rotulo: 'chat' })]).map((x) => x.rotulo)).toEqual(['chat']);
  });
});
