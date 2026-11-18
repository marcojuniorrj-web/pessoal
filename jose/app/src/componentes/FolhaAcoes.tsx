import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { JANELA_ABERTURA_MS } from '../estado/pressao-longa';
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

/**
 * Folha de ações na parte de baixo (como no WhatsApp), acima da barra de abas, com fundo escurecido.
 * Fecha com Esc, tocando fora ou em Cancelar; o foco fica preso nela e volta ao balão.
 */
export function FolhaAcoes({ comResposta, semRede, origem, aoFechar, aoCopiar, aoApagar, aoApagarComResposta }: Props) {
  const folhaRef = useRef<HTMLDivElement>(null);
  const abertaEm = useRef(performance.now());
  /** Alvo do último pointerdown que aconteceu dentro da folha depois da janela de abertura. */
  const ultimoToque = useRef<EventTarget | null>(null);
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;

  const aoTocar = (e: PointerEvent<HTMLElement>) => {
    ultimoToque.current = e.timeStamp - abertaEm.current > JANELA_ABERTURA_MS ? e.target : null;
  };
  /** Clique de verdade: do teclado (detail 0) ou depois de um pointerdown válido sobre o mesmo elemento. */
  const valido = (e: MouseEvent<HTMLElement>) => e.detail === 0 || (ultimoToque.current instanceof Node && e.currentTarget.contains(ultimoToque.current));
  const agir = (fn: () => void) => (e: MouseEvent<HTMLElement>) => {
    if (valido(e)) fn();
  };

  // Foco: vai para dentro da folha (isso também fecha o teclado do iPhone); ao fechar volta ao balão.
  useEffect(() => {
    folhaRef.current?.querySelector<HTMLElement>(FOCAVEIS)?.focus();
    return () => {
      if (origem?.isConnected) origem.focus({ preventScroll: true });
    };
  }, [origem]);

  // Se o foco escapar da folha (ex.: o mousedown de compatibilidade do iOS cai no fundo e leva o foco ao body), volta ao 1º botão.
  useEffect(() => {
    const aoPerder = () => {
      setTimeout(() => {
        const folhaEl = folhaRef.current;
        if (folhaEl?.isConnected && !folhaEl.contains(document.activeElement)) folhaEl.querySelector<HTMLElement>(FOCAVEIS)?.focus();
      }, 0);
    };
    document.addEventListener('focusout', aoPerder);
    return () => document.removeEventListener('focusout', aoPerder);
  }, []);

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
      onPointerDownCapture={aoTocar}
      // O mousedown de compatibilidade (depois do toque) não pode tirar o foco da folha.
      onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}
      onClick={(e) => {
        if (e.target === e.currentTarget && (e.detail === 0 || ultimoToque.current === e.target)) aoFechar();
      }}
    >
      <div ref={folhaRef} className="folha" role="dialog" aria-modal="true" aria-label="Ações da mensagem" onKeyDown={prenderTab}>
        <button type="button" className="folha__acao" onClick={agir(aoCopiar)}>
          Copiar
        </button>
        <button type="button" className="folha__acao folha__acao--perigo" disabled={semRede} onClick={agir(aoApagar)}>
          Apagar mensagem
        </button>
        {comResposta && (
          <button type="button" className="folha__acao folha__acao--perigo" disabled={semRede} onClick={agir(aoApagarComResposta)}>
            Apagar mensagem e resposta
          </button>
        )}
        <Botao className="folha__cancelar" onClick={agir(aoFechar)}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}
