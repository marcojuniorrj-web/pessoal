import { formatarContador } from '../estado/gravacao';
import { useToqueConfiavel } from '../estado/toque-confiavel';
import { IconeFechar } from './IconesVoz';

interface Props {
  fase: 'gravando' | 'transcrevendo';
  /** Milissegundos que faltam para os 2:00 (só na fase gravando). */
  restanteMs: number;
  aoCancelar: () => void;
}

/**
 * Meio do rodapé durante a voz. Gravando: ✕ (cancelar, à esquerda), ponto âmbar pulsante e contador regressivo a partir de 2:00.
 * Transcrevendo: "Transcrevendo áudio…". O ■ (parar e enviar) é o botão de ação da direita (BotaoAcaoChat).
 * O ✕ só age se o toque começou depois de ele aparecer (clique fantasma do iOS).
 */
export function BarraGravacao({ fase, restanteMs, aoCancelar }: Props) {
  const toque = useToqueConfiavel(fase);
  if (fase === 'transcrevendo') {
    return (
      <div className="gravacao gravacao--transcrevendo" role="status">
        <span className="spinner" aria-hidden="true" />
        <span>Transcrevendo áudio…</span>
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        className="chat__cancelar-gravacao"
        aria-label="Cancelar gravação"
        onPointerDown={toque.aoPointerDown}
        onClick={(e) => {
          if (toque.valido(e)) aoCancelar();
        }}
      >
        <IconeFechar />
      </button>
      <div className="gravacao" role="timer" aria-label="Gravando, tempo restante">
        <span className="gravacao__ponto" aria-hidden="true" />
        <span className="gravacao__tempo">{formatarContador(restanteMs)}</span>
      </div>
    </>
  );
}
