import { createContext, useContext, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { manterAcimaDoToast } from '../estado/toast-espaco';
import { criarFilaToast, type FilaToast } from '../estado/fila-toast';

const Contexto = createContext<FilaToast | null>(null);
/** Folga entre o aviso e o conteúdo que ele deixa livre. */
const RESPIRO_TOAST_PX = 16;

export function ToastProvider({ children }: { children: ReactNode }) {
  const fila = useMemo(() => criarFilaToast(), []);
  const toast = useSyncExternalStore(fila.assinar, fila.obter);
  const avisoRef = useRef<HTMLDivElement>(null);

  // O aviso é fixo sobre o conteúdo: publica a altura que ele ocupa (--reserva-toast) para a tela
  // abrir espaço no fim e nunca deixar um botão ou formulário atrás dele.
  const aberto = toast !== null;
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const el = avisoRef.current;
    if (!aberto || !el) {
      raiz.style.removeProperty('--reserva-toast');
      return;
    }
    const medir = () => raiz.style.setProperty('--reserva-toast', `${Math.ceil(el.offsetHeight) + RESPIRO_TOAST_PX}px`);
    medir();
    manterAcimaDoToast(document.querySelector('.form-item'));
    const obs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    obs?.observe(el);
    return () => {
      obs?.disconnect();
      raiz.style.removeProperty('--reserva-toast');
    };
  }, [aberto, toast?.id]);

  return (
    <Contexto.Provider value={fila}>
      {children}
      <div role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id} ref={avisoRef}>
            <span>{toast.mensagem}</span>
            {toast.acao && (
              <button
                type="button"
                className="toast__acao"
                onClick={() => {
                  toast.acao!.aoTocar();
                  fila.fechar();
                }}
              >
                {toast.acao.rotulo}
              </button>
            )}
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}

export function useToast() {
  const fila = useContext(Contexto);
  if (!fila) throw new Error('useToast fora do ToastProvider');
  return fila.mostrar;
}

/** Id do aviso na tela (ou null): quem rola sozinho (o Chat) usa para acompanhar o espaço reservado. */
export function useToastAtual(): number | null {
  const fila = useContext(Contexto);
  if (!fila) throw new Error('useToastAtual fora do ToastProvider');
  return useSyncExternalStore(fila.assinar, () => fila.obter()?.id ?? null);
}
