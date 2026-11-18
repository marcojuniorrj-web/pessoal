import type { Ref } from 'react';
import { AREAS_ITEM, ROTULO_AREA, type AreaItem } from '@compartilhado/areas';
import { contadorTitulo, LIMITE_TITULO } from '../estado/item-edicao';
import { CampoPrazo } from './CampoPrazo';

export interface ValoresItem {
  titulo: string;
  area: AreaItem;
  /** AAAA-MM-DD ou '' (sem prazo). */
  prazo: string;
}

interface Props extends ValoresItem {
  /** Prefixo dos ids (cada instância precisa de ids próprios). */
  idBase: string;
  /** Nomes acessíveis, ex.: "Título da tarefa" e "Área da tarefa". */
  rotuloTitulo: string;
  rotuloArea: string;
  placeholder?: string;
  desabilitado?: boolean;
  aoMudar: (parcial: Partial<ValoresItem>) => void;
  campoRef?: Ref<HTMLTextAreaElement>;
}

/** Título (até 120 caracteres), chips de área e seletor de prazo: usado no cartão 📌/🎯 e nas abas Tarefas e Metas. */
export function CamposItem({ idBase, titulo, area, prazo, rotuloTitulo, rotuloArea, placeholder, desabilitado, aoMudar, campoRef }: Props) {
  const contador = contadorTitulo(titulo);
  return (
    <div className="campos-item">
      <label className="so-leitor" htmlFor={`${idBase}-titulo`}>
        {rotuloTitulo}
      </label>
      <textarea
        id={`${idBase}-titulo`}
        ref={campoRef}
        className="cartao-sugestao__campo campos-item__titulo"
        rows={2}
        maxLength={LIMITE_TITULO}
        placeholder={placeholder}
        value={titulo}
        disabled={desabilitado}
        // O título é uma linha só: a quebra de linha do teclado vira espaço.
        onChange={(e) => aoMudar({ titulo: e.target.value.replace(/\s*\n\s*/g, ' ') })}
      />
      <p className={`cartao-sugestao__contador texto-2${contador.perto ? ' cartao-sugestao__contador--perto' : ''}`}>{contador.rotulo}</p>
      <div className="chips-area" role="radiogroup" aria-label={rotuloArea}>
        {AREAS_ITEM.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={area === a} className="chip-area" disabled={desabilitado} onClick={() => aoMudar({ area: a })}>
            {ROTULO_AREA[a]}
          </button>
        ))}
      </div>
      <CampoPrazo id={`${idBase}-prazo`} valor={prazo} desabilitado={desabilitado} aoMudar={(p) => aoMudar({ prazo: p })} />
    </div>
  );
}
