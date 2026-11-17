import { useEffect } from 'react';

/**
 * Faz o campo de digitação subir junto com o teclado do celular: publica a altura visível
 * (`--altura-visivel`) e marca `data-teclado` no <html> (a barra de abas some enquanto o teclado está aberto).
 */
export function useTecladoVirtual() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const raiz = document.documentElement;
    const atualizar = () => {
      raiz.style.setProperty('--altura-visivel', `${vv.height}px`);
      raiz.dataset.teclado = window.innerHeight - vv.height > 120 ? 'aberto' : 'fechado';
    };
    atualizar();
    vv.addEventListener('resize', atualizar);
    vv.addEventListener('scroll', atualizar);
    return () => {
      vv.removeEventListener('resize', atualizar);
      vv.removeEventListener('scroll', atualizar);
      raiz.style.removeProperty('--altura-visivel');
      delete raiz.dataset.teclado;
    };
  }, []);
}
