import type { RespostaRapida } from '@compartilhado/boasvindas';
import { Botao } from './Botao';

interface Props {
  respostas: readonly RespostaRapida[];
  desabilitado?: boolean;
  aoEscolher: (r: RespostaRapida) => void;
}

/** Botões de resposta rápida das boas-vindas (alvo de 48 px, quebram de linha). Ficam dentro do rodapé: o aviso nunca os cobre. */
export function RespostasRapidas({ respostas, desabilitado, aoEscolher }: Props) {
  if (!respostas.length) return null;
  return (
    <div className="rapidas" role="group" aria-label="Respostas rápidas">
      {respostas.map((r) => (
        <Botao key={r.rotulo} className="rapidas__botao" disabled={desabilitado} onClick={() => aoEscolher(r)}>
          {r.rotulo}
        </Botao>
      ))}
    </div>
  );
}
