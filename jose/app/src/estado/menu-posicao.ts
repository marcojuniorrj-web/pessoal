// Menu ⋯ ("Apagar") abre embaixo do item. Se o fim dele ficaria atrás da barra de abas fixa (ou fora da janela),
// abre para cima, desde que caiba lá; assim o alvo de 48px nunca fica cortado. Uso: <div ref={posicionarMenu}>.
const FOLGA_PX = 4;

export function posicionarMenu(menu: HTMLElement | null): void {
  if (!menu) return;
  menu.removeAttribute('data-para-cima');
  const barra = document.querySelector('nav')?.getBoundingClientRect();
  // Com o teclado aberto a barra some (altura 0): o limite é a base da janela.
  const limite = barra && barra.height > 0 ? barra.top : window.innerHeight;
  const caixa = menu.getBoundingClientRect();
  if (caixa.bottom <= limite - FOLGA_PX) return;
  const item = (menu.offsetParent as HTMLElement | null)?.getBoundingClientRect();
  if (!item) return;
  // Para cima, a base do menu fica 8px abaixo do topo do item (espelho de "para baixo": o topo, 8px acima da base).
  const topoParaCima = item.top + 8 - caixa.height;
  if (topoParaCima >= 0) menu.setAttribute('data-para-cima', '');
}
