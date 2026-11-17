import { Botao } from './Botao';
import type { Bolha } from '../estado/chat';

interface Props {
  bolha: Bolha;
  aoTentarDeNovo?: () => void;
}

/** Balão de conversa: Marco à direita, José à esquerda (referência: WhatsApp). */
export function Balao({ bolha, aoTentarDeNovo }: Props) {
  if (bolha.autor === 'marco') {
    return (
      <div className="balao balao--marco" data-autor="marco">
        {bolha.origem === 'voz' && <span aria-label="Enviado por voz" className="balao__voz">🎤 </span>}
        {bolha.texto}
      </div>
    );
  }
  if (bolha.estado === 'erro' && bolha.erro) {
    const semBotao = bolha.erro.tipo === 'limite';
    return (
      <div className="balao balao--jose balao--erro" data-autor="jose" role="alert">
        {bolha.texto && <p className="balao__parcial">{bolha.texto}</p>}
        <p>{bolha.erro.mensagem}</p>
        {!semBotao && aoTentarDeNovo && (
          <Botao variante="padrao" onClick={aoTentarDeNovo}>
            Tentar de novo
          </Botao>
        )}
      </div>
    );
  }
  if (bolha.estado === 'transmitindo' && !bolha.texto) {
    return (
      <div className="balao balao--jose" data-autor="jose" role="status">
        José está pensando
        <span className="pontinhos" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    );
  }
  return (
    <div className="balao balao--jose" data-autor="jose" aria-busy={bolha.estado === 'transmitindo' || undefined}>
      {bolha.texto}
    </div>
  );
}
