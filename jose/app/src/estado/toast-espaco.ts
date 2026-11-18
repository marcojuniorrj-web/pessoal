// O aviso (toast) é fixo sobre o conteúdo. Se um formulário aberto termina atrás dele, rola a página
// o mínimo para a base do formulário (onde ficam Salvar e Cancelar) ficar acima do aviso.
const RESPIRO_PX = 8;

/** Topo do aviso na janela, ou null se não há aviso. Usa a posição final (a animação de entrada move o aviso 8px). */
export function topoDoToast(): number | null {
  const el = document.querySelector<HTMLElement>('.toast');
  if (!el) return null;
  const base = parseFloat(getComputedStyle(el).bottom) || 0;
  return window.innerHeight - base - el.offsetHeight;
}

/** Garante que a base de `el` fique acima do aviso. Não faz nada sem aviso ou se já está livre. */
export function manterAcimaDoToast(el: Element | null): void {
  const topo = topoDoToast();
  if (topo === null || !el) return;
  const excesso = el.getBoundingClientRect().bottom - (topo - RESPIRO_PX);
  if (excesso > 0) window.scrollBy(0, excesso);
}
