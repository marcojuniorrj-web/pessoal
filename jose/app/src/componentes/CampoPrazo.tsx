import { useRef } from 'react';
import { Botao } from './Botao';

interface Props {
  id: string;
  /** AAAA-MM-DD ou '' (sem prazo). */
  valor: string;
  aoMudar: (prazo: string) => void;
  desabilitado?: boolean;
}

/** Seletor de prazo (opcional): campo de data nativo e "Sem prazo" para limpar. Não passa da largura da tela (iOS dá largura própria ao campo de data). */
export function CampoPrazo({ id, valor, aoMudar, desabilitado }: Props) {
  const campoRef = useRef<HTMLInputElement>(null);
  return (
    <div className="campo-prazo">
      <label className="campo-prazo__rotulo texto-2" htmlFor={id}>
        Prazo (opcional)
      </label>
      <div className="campo-prazo__linha">
        <input ref={campoRef} id={id} type="date" className="campo-prazo__input" value={valor} disabled={desabilitado} onChange={(e) => aoMudar(e.target.value)} />
        {valor && (
          <Botao
            variante="link"
            disabled={desabilitado}
            onClick={() => {
              aoMudar('');
              // O botão some junto com o prazo: o foco vai para o campo de data (senão o Esc deixaria de funcionar).
              campoRef.current?.focus();
            }}
          >
            Sem prazo
          </Botao>
        )}
      </div>
    </div>
  );
}
