// Fila de 1: um novo aviso substitui o atual. Dura 4 s (telas.md).
export const DURACAO_TOAST_MS = 4000;

export interface ToastDados {
  id: number;
  mensagem: string;
  acao?: { rotulo: string; aoTocar: () => void };
}

export function criarFilaToast() {
  let atual: ToastDados | null = null;
  let proximoId = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ouvintes = new Set<() => void>();
  const avisar = () => ouvintes.forEach((o) => o());

  const fechar = () => {
    clearTimeout(timer);
    atual = null;
    avisar();
  };

  return {
    mostrar(mensagem: string, acao?: ToastDados['acao']) {
      clearTimeout(timer);
      atual = { id: proximoId++, mensagem, acao };
      timer = setTimeout(fechar, DURACAO_TOAST_MS);
      avisar();
    },
    fechar,
    obter: () => atual,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };
}

export type FilaToast = ReturnType<typeof criarFilaToast>;
