import { useToqueConfiavel } from '../estado/toque-confiavel';
import { IconeMicrofone, IconeParar } from './IconesVoz';

/** O que o botão único do rodapé faz agora: com o campo vazio é o 🎤; com texto é Enviar; gravando é ■; transcrevendo fica ocupado. */
export type ModoAcao = 'microfone' | 'enviar' | 'parar' | 'transcrevendo';

interface Props {
  modo: ModoAcao;
  /** Offline, José respondendo ou (no Enviar) campo sem texto. Não vale para ■ e Transcrevendo. */
  desabilitado: boolean;
  aoMicrofone: () => void;
  aoEnviar: () => void;
  aoParar: () => void;
}

const ROTULOS: Record<ModoAcao, string> = {
  microfone: 'Gravar áudio',
  enviar: 'Enviar',
  parar: 'Parar e enviar áudio',
  transcrevendo: 'Transcrevendo áudio',
};

/**
 * Botão de ação à direita do campo, como no WhatsApp. É UM elemento só (o foco não se perde quando o modo muda) e nunca
 * `type="submit"` (trocar o tipo no meio do clique cancelaria o envio). O ■ só age se o toque começou depois de ele aparecer.
 */
export function BotaoAcaoChat({ modo, desabilitado, aoMicrofone, aoEnviar, aoParar }: Props) {
  const toque = useToqueConfiavel(modo);
  const ocupado = modo === 'transcrevendo';
  return (
    <button
      type="button"
      className="botao botao--principal chat__acao"
      data-modo={modo}
      aria-label={ROTULOS[modo]}
      aria-busy={ocupado || undefined}
      // Transcrevendo usa aria-disabled (e não disabled) para o foco não se perder durante a espera.
      aria-disabled={ocupado || undefined}
      disabled={modo === 'parar' || ocupado ? false : desabilitado}
      onPointerDown={toque.aoPointerDown}
      onClick={(e) => {
        if (modo === 'parar') {
          if (toque.valido(e)) aoParar();
        } else if (modo === 'microfone') aoMicrofone();
        else if (modo === 'enviar') aoEnviar();
      }}
    >
      {modo === 'microfone' && <IconeMicrofone />}
      {modo === 'parar' && <IconeParar />}
      {modo === 'enviar' && <span aria-hidden="true">➤</span>}
      {ocupado && <span className="spinner" aria-hidden="true" />}
    </button>
  );
}
