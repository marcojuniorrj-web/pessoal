import { horaMensagem } from '@compartilhado/datas';
import { Botao } from './Botao';
import { IconeMicrofone } from './IconesVoz';
import type { Bolha } from '../estado/chat';
import { usePressaoLonga } from '../estado/usar-pressao-longa';

interface Props {
  bolha: Bolha;
  /** Fuso do Marco (de /api/eu), para a hora do balão. */
  fuso: string;
  aoTentarDeNovo?: () => void;
  /** Abre a folha de ações (pressão longa, botão direito, Enter ou o ⋯ do mouse). Sem isto o balão não abre nada. */
  aoAbrirAcoes?: (bolha: Bolha, origem: HTMLElement) => void;
}

/** Hora do balão: `<time datetime>` em 24 h, com o rótulo para leitores de tela ("enviada às 14:32"). */
function Hora({ bolha, fuso, aoAbrirMais }: { bolha: Bolha; fuso: string; aoAbrirMais?: (el: HTMLElement) => void }) {
  if (!bolha.criadaEm) return null;
  const hora = horaMensagem(bolha.criadaEm, fuso);
  return (
    <div className="mensagem__meta">
      <time className="mensagem__hora" dateTime={bolha.criadaEm}>
        <span className="so-leitor">{bolha.autor === 'marco' ? 'enviada às ' : 'recebida às '}</span>
        {hora}
      </time>
      {/* Só para quem usa mouse: aparece ao passar o mouse ou focar. No celular a folha abre com pressão longa. */}
      {aoAbrirMais && (
        <button type="button" className="mensagem__mais" aria-label="Ações da mensagem" aria-haspopup="dialog" onClick={(e) => aoAbrirMais(e.currentTarget)}>
          ⋯
        </button>
      )}
    </div>
  );
}

/** Balão de conversa: Marco à direita, José à esquerda (referência: WhatsApp). Segurar o balão abre as ações. */
export function Balao({ bolha, fuso, aoTentarDeNovo, aoAbrirAcoes }: Props) {
  const pode = !!aoAbrirAcoes && bolha.estado === 'ok';
  const abrir = (el: HTMLElement) => aoAbrirAcoes?.(bolha, el);
  const { pressionando, props } = usePressaoLonga(abrir, pode);
  const acoes = pode
    ? { ...props, tabIndex: 0, 'aria-haspopup': 'dialog' as const, 'data-acoes': '', 'data-pressionando': pressionando || undefined }
    : {};
  // O ⋯ só existe para o mouse: o balão que ele abre é o mesmo (foco volta ao balão ao fechar).
  const abrirDoMais = pode
    ? (botao: HTMLElement) => {
        const balao = botao.closest('.mensagem')?.querySelector<HTMLElement>('.balao');
        if (balao) abrir(balao);
      }
    : undefined;

  if (bolha.autor === 'marco') {
    return (
      <div className="mensagem mensagem--marco" data-mensagem-id={bolha.id}>
        <div className="balao balao--marco" data-autor="marco" {...acoes}>
          {bolha.origem === 'voz' && (
            <span role="img" aria-label="Enviado por voz" className="balao__voz">
              <IconeMicrofone tamanho={14} />
            </span>
          )}
          {bolha.texto}
        </div>
        <Hora bolha={bolha} fuso={fuso} aoAbrirMais={abrirDoMais} />
      </div>
    );
  }
  if (bolha.estado === 'erro' && bolha.erro) {
    const semBotao = bolha.erro.tipo === 'limite';
    return (
      <div className="mensagem mensagem--jose">
        <div className="balao balao--jose balao--erro" data-autor="jose" role="alert">
          {bolha.texto && <p className="balao__parcial">{bolha.texto}</p>}
          <p>{bolha.erro.mensagem}</p>
          {!semBotao && aoTentarDeNovo && (
            <Botao variante="padrao" onClick={aoTentarDeNovo}>
              Tentar de novo
            </Botao>
          )}
        </div>
      </div>
    );
  }
  if (bolha.estado === 'transmitindo' && !bolha.texto) {
    return (
      <div className="mensagem mensagem--jose">
        <div className="balao balao--jose" data-autor="jose" role="status">
          José está pensando
          <span className="pontinhos" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="mensagem mensagem--jose" data-mensagem-id={bolha.id}>
      <div className="balao balao--jose" data-autor="jose" aria-busy={bolha.estado === 'transmitindo' || undefined} {...acoes}>
        {bolha.texto}
      </div>
      <Hora bolha={bolha} fuso={fuso} aoAbrirMais={abrirDoMais} />
    </div>
  );
}
