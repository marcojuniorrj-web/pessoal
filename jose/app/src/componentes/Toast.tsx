import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { criarFilaToast, type FilaToast } from '../estado/fila-toast';

const Contexto = createContext<FilaToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const fila = useMemo(() => criarFilaToast(), []);
  const toast = useSyncExternalStore(fila.assinar, fila.obter);
  return (
    <Contexto.Provider value={fila}>
      {children}
      <div role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
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
