// O iOS pode soltar um "clique fantasma" no botão que aparece sob o dedo (ex.: o ■ que surge no lugar do 🎤 quando a gravação
// começa). Mesma regra da folha de ações: o botão só age se o `pointerdown` desse clique veio DEPOIS de ele aparecer.
// O teclado (clique com detail 0, Enter/Espaço) sempre vale.
import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { JANELA_ABERTURA_MS } from './pressao-longa';

/** O toque que começou em `pointerdown` (timeStamp) é de verdade para um botão que apareceu em `desde`? */
export function toqueValido(pointerdown: number | null, desde: number, janelaMs: number = JANELA_ABERTURA_MS): boolean {
  return pointerdown !== null && pointerdown - desde > janelaMs;
}

/** `chave` muda quando o botão "reaparece" (outro modo): a janela de abertura recomeça. */
export function useToqueConfiavel(chave: unknown) {
  const desde = useRef(performance.now());
  const ultimo = useRef<number | null>(null);
  useEffect(() => {
    desde.current = performance.now();
    ultimo.current = null;
  }, [chave]);
  return {
    aoPointerDown: (e: PointerEvent<HTMLElement>) => {
      ultimo.current = e.timeStamp;
    },
    valido: (e: MouseEvent<HTMLElement>) => e.detail === 0 || toqueValido(ultimo.current, desde.current),
  };
}
