import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { criarPressaoLonga } from './pressao-longa';

/**
 * Props para espalhar num elemento que abre algo com pressão longa (Pointer Events + timer), clique direito,
 * Enter, tecla de menu de contexto ou Shift+F10. Não impede a rolagem: o movimento cancela e o navegador rola.
 * `aoAbrir` recebe o elemento (para devolver o foco a ele ao fechar).
 */
export function usePressaoLonga(aoAbrir: (el: HTMLElement) => void, ativo: boolean) {
  const [pressionando, setPressionando] = useState(false);
  const aoAbrirRef = useRef(aoAbrir);
  aoAbrirRef.current = aoAbrir;
  const elRef = useRef<HTMLElement | null>(null);

  const pressao = useMemo(
    () =>
      criarPressaoLonga({
        aoComecar: () => setPressionando(true),
        aoTerminar: () => setPressionando(false),
        aoDisparar: () => {
          // Vibração curta de confirmação, onde existir (o iPhone não tem).
          try {
            navigator.vibrate?.(15);
          } catch {
            /* sem vibração */
          }
          if (elRef.current) aoAbrirRef.current(elRef.current);
        },
      }),
    [],
  );
  useEffect(() => () => pressao.terminar(), [pressao]);
  useEffect(() => {
    if (!ativo) pressao.terminar();
  }, [ativo, pressao]);

  if (!ativo) return { pressionando: false, props: {} };

  return {
    pressionando,
    props: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return; // o botão direito abre pelo contextmenu
        elRef.current = e.currentTarget;
        pressao.iniciar(e.clientX, e.clientY);
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => pressao.mover(e.clientX, e.clientY),
      onPointerUp: () => pressao.terminar(),
      onPointerCancel: () => pressao.terminar(),
      onPointerLeave: () => pressao.terminar(),
      // O iOS/Android abrem o próprio menu numa pressão longa; aqui o único menu é a folha de ações.
      onContextMenu: (e: MouseEvent<HTMLElement>) => {
        e.preventDefault();
        elRef.current = e.currentTarget;
        aoAbrirRef.current(e.currentTarget);
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
          e.preventDefault();
          aoAbrirRef.current(e.currentTarget);
        }
      },
    },
  };
}
