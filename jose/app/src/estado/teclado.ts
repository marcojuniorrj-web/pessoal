import { useEffect } from 'react';

export interface MedidasTela {
  /** window.innerHeight */
  alturaJanela: number;
  /** visualViewport.height */
  alturaVisivel: number;
  /** visualViewport.scale (1 = sem zoom) */
  escala: number;
  /** visualViewport.offsetTop (o iPhone "empurra" a página quando o teclado abre) */
  deslocamentoTopo: number;
  /** há um campo de texto com o foco? */
  campoEmFoco: boolean;
}

export interface ResultadoTeclado {
  aberto: boolean;
  /** altura visível a usar (só com o teclado aberto) */
  altura: number | null;
  /** deslocamento do topo a compensar (só com o teclado aberto) */
  topo: number;
}

/**
 * Decide se o teclado virtual está aberto. Só vale como "aberto" quando:
 *  - não há zoom (no iPhone o zoom também encolhe a altura visível e não é teclado);
 *  - um campo de texto está com o foco (senão o teclado não pode estar aberto);
 *  - a altura visível encolheu bastante em relação à da janela.
 * Assim a barra de abas e a altura da tela nunca ficam "presas" por engano.
 */
export function calcularTeclado(m: MedidasTela): ResultadoTeclado {
  const semZoom = m.escala <= 1.01;
  const aberto = semZoom && m.campoEmFoco && m.alturaJanela - m.alturaVisivel > 120;
  return aberto
    ? { aberto: true, altura: m.alturaVisivel, topo: Math.max(0, m.deslocamentoTopo) }
    : { aberto: false, altura: null, topo: 0 };
}

function campoEmFoco(): boolean {
  const el = document.activeElement;
  return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || (el as HTMLElement).isContentEditable);
}

/**
 * Faz o campo de digitação subir junto com o teclado do celular: com o teclado aberto publica
 * `--altura-visivel` e `--topo-visivel` e marca `data-teclado="aberto"` no <html> (a barra de abas some).
 * Fora disso nada é publicado e o layout usa a altura normal da tela.
 */
export function useTecladoVirtual() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const raiz = document.documentElement;
    const atualizar = () => {
      const r = calcularTeclado({
        alturaJanela: window.innerHeight,
        alturaVisivel: vv.height,
        escala: vv.scale,
        deslocamentoTopo: vv.offsetTop,
        campoEmFoco: campoEmFoco(),
      });
      if (r.aberto && r.altura !== null) {
        raiz.style.setProperty('--altura-visivel', `${r.altura}px`);
        raiz.style.setProperty('--topo-visivel', `${r.topo}px`);
        raiz.dataset.teclado = 'aberto';
      } else {
        raiz.style.removeProperty('--altura-visivel');
        raiz.style.removeProperty('--topo-visivel');
        raiz.dataset.teclado = 'fechado';
      }
    };
    // Ao perder o foco o teclado fecha; reconfere logo e de novo depois que ele terminou de baixar.
    const aoSairDoCampo = () => {
      atualizar();
      window.setTimeout(atualizar, 300);
    };
    atualizar();
    vv.addEventListener('resize', atualizar);
    vv.addEventListener('scroll', atualizar);
    document.addEventListener('focusin', atualizar);
    document.addEventListener('focusout', aoSairDoCampo);
    return () => {
      vv.removeEventListener('resize', atualizar);
      vv.removeEventListener('scroll', atualizar);
      document.removeEventListener('focusin', atualizar);
      document.removeEventListener('focusout', aoSairDoCampo);
      raiz.style.removeProperty('--altura-visivel');
      raiz.style.removeProperty('--topo-visivel');
      delete raiz.dataset.teclado;
    };
  }, []);
}
