import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Botao } from './Botao';

export interface AcoesDaFolha {
  /** Só nas mensagens do Marco com resposta do José logo depois. */
  comResposta: boolean;
  /** Offline: copiar funciona, apagar não. */
  semRede: boolean;
}

interface Props extends AcoesDaFolha {
  /** Elemento que abriu a folha: recebe o foco de volta ao fechar. */
  origem: HTMLElement | null;
  aoFechar: () => void;
  aoCopiar: () => void;
  aoApagar: () => void;
  aoApagarComResposta: () => void;
}

const FOCAVEIS = 'button:not([disabled])';
/** Um toque no fundo escurecido logo depois de abrir (o dedo que acabou de soltar) não fecha a folha. */
const GUARDA_FUNDO_MS = 350;

/**
 * Folha de ações na parte de baixo (como no WhatsApp), acima da barra de abas, com fundo escurecido.
 * Fecha com Esc, tocando fora ou em Cancelar; o foco fica preso nela e volta ao balão.
 */
export function FolhaAcoes({ comResposta, semRede, origem, aoFechar, aoCopiar, aoApagar, aoApagarComResposta }: Props) {
  const folhaRef = useRef<HTMLDivElement>(null);
  const abertaEm = useRef(Date.now());
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;

  // Foco: vai para dentro da folha (isso também fecha o teclado do iPhone); ao fechar volta ao balão.
  useEffect(() => {
    folhaRef.current?.querySelector<HTMLElement>(FOCAVEIS)?.focus();
    return () => {
      if (origem?.isConnected) origem.focus({ preventScroll: true });
    };
  }, [origem]);

  useEffect(() => {
    const aoTeclar = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      fecharRef.current();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  // Prende o Tab dentro da folha.
  const prenderTab = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab') return;
    const lista = Array.from(folhaRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []);
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    if (!primeiro || !ultimo) return e.preventDefault();
    const ativo = document.activeElement;
    if (!folhaRef.current?.contains(ativo) || (e.shiftKey && ativo === primeiro)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && ativo === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  };

  return (
    <div
      className="folha-fundo"
      onClick={(e) => {
        if (e.target === e.currentTarget && Date.now() - abertaEm.current > GUARDA_FUNDO_MS) aoFechar();
      }}
    >
      <div ref={folhaRef} className="folha" role="dialog" aria-modal="true" aria-label="Ações da mensagem" onKeyDown={prenderTab}>
        <button type="button" className="folha__acao" onClick={aoCopiar}>
          Copiar
        </button>
        <button type="button" className="folha__acao folha__acao--perigo" disabled={semRede} onClick={aoApagar}>
          Apagar mensagem
        </button>
        {comResposta && (
          <button type="button" className="folha__acao folha__acao--perigo" disabled={semRede} onClick={aoApagarComResposta}>
            Apagar mensagem e resposta
          </button>
        )}
        <Botao className="folha__cancelar" onClick={aoFechar}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}
