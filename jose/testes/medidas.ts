// Medidas de layout usadas nos testes de navegador. A lógica de comparação é pura (testada em medidas.test.ts):
// o Playwright roda em Chromium e não pega tudo do iPhone, então os números precisam ser conferidos com cuidado.
import type { Page } from '@playwright/test';

export interface Caixa {
  rotulo: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const TOLERANCIA = 0.5;

/** Caixas que passam da largura da tela (à direita ou à esquerda). */
export function foraDaLargura(caixas: Caixa[], largura: number, tolerancia = TOLERANCIA): Caixa[] {
  return caixas.filter((c) => c.x < -tolerancia || c.x + c.width > largura + tolerancia);
}

/** Dois retângulos se sobrepõem (encostar na borda não conta). */
export function sobrepoe(a: Caixa, b: Caixa, tolerancia = TOLERANCIA): boolean {
  return a.x < b.x + b.width - tolerancia && b.x < a.x + a.width - tolerancia && a.y < b.y + b.height - tolerancia && b.y < a.y + a.height - tolerancia;
}

/** Alvos de toque menores que `minimo` px em altura ou largura. */
export function menoresQue(caixas: Caixa[], minimo = 48, tolerancia = TOLERANCIA): Caixa[] {
  return caixas.filter((c) => c.height < minimo - tolerancia || c.width < minimo - tolerancia);
}

export interface Conteudo {
  rotulo: string;
  scrollWidth: number;
  clientWidth: number;
  /** overflow-x e text-overflow computados: truncar de propósito (ellipsis) não conta como estouro. */
  overflowX: string;
  textOverflow: string;
}

/**
 * Elementos cujo conteúdo é mais largo que a própria caixa (ex.: uma palavra de 80 caracteres sem quebra de linha:
 * a caixa cabe na tela, mas o texto vaza para fora dela). Truncar com reticências ou cortar de propósito não conta.
 */
export function comTransbordo(itens: Conteudo[], tolerancia = 1): Conteudo[] {
  return itens.filter((i) => i.scrollWidth > i.clientWidth + tolerancia && i.textOverflow !== 'ellipsis' && !['hidden', 'clip'].includes(i.overflowX));
}

/** Medidas de todos os elementos que casam com o seletor (só os visíveis). */
export async function medir(page: Page, seletor: string): Promise<Caixa[]> {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { rotulo: `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60) + ` "${(el.textContent ?? '').trim().slice(0, 20)}"`, x: r.x, y: r.y, width: r.width, height: r.height };
      })
      .filter((c) => c.width > 0 && c.height > 0);
  }, seletor);
}

/** Conteúdo que vaza da própria caixa (texto sem quebra, linha de botões sem wrap...). */
export async function elementosComTransbordo(page: Page, seletor = 'body, body *'): Promise<Conteudo[]> {
  const itens = await page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const e = el as HTMLElement;
      const css = getComputedStyle(e);
      return { rotulo: `${e.tagName.toLowerCase()}.${e.className}`.slice(0, 60) + ` "${(e.textContent ?? '').trim().slice(0, 20)}"`, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, overflowX: css.overflowX, textOverflow: css.textOverflow };
    });
  }, seletor);
  return comTransbordo(itens);
}

/** Nada pode passar da largura da tela: confere a rolagem lateral e a borda de todos os elementos da página. */
export async function elementosForaDaTela(page: Page): Promise<{ rolagem: number; largura: number; fora: Caixa[]; transbordo: Conteudo[] }> {
  const { rolagem, largura } = await page.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, largura: window.innerWidth }));
  const fora = foraDaLargura(await medir(page, 'body *:not(.so-leitor)'), largura);
  return { rolagem, largura, fora, transbordo: (await elementosComTransbordo(page)).filter((i) => !i.rotulo.includes('so-leitor')) };
}
