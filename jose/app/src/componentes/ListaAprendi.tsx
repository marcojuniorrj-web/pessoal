import { useLayoutEffect, useRef } from 'react';
import { AREAS_MEMORIA, ROTULO_AREA } from '@compartilhado/areas';
import { contadorTexto, LIMITE_MEMORIA } from '../estado/memoria-edicao';
import { erroDoItem, type EdicaoAprendi, type ItemAprendi } from '../estado/lista-aprendi';

interface Props {
  itens: ItemAprendi[];
  aoEditar: (id: string, edicao: EdicaoAprendi) => void;
  desabilitado?: boolean;
  /** Mostra o erro dos itens marcados com texto inválido (depois de tentar salvar). */
  mostrarErros?: boolean;
}

/** Campo que cresce com o texto (sem rolagem interna): 300 caracteres e palavras longas cabem em 320 px. */
function CampoTexto({ item, indice, desabilitado, aoMudar }: { item: ItemAprendi; indice: number; desabilitado?: boolean; aoMudar: (t: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const ajustar = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(ajustar, [item.texto]);
  // Girar o aparelho muda a largura (e as linhas): mede de novo só quando a largura muda (a altura mudar não pode causar laço).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let largura = el.clientWidth;
    const obs = new ResizeObserver(() => {
      if (el.clientWidth === largura) return;
      largura = el.clientWidth;
      ajustar();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      className="aprendi__texto"
      rows={2}
      maxLength={LIMITE_MEMORIA}
      aria-label={`Texto da memória ${indice + 1}`}
      value={item.texto}
      disabled={desabilitado}
      onChange={(e) => aoMudar(e.target.value)}
    />
  );
}

/**
 * Lista marcável "O que aprendi sobre você" (telas.md, Boas-vindas): cada item tem a caixa (alvo de 48 px), o texto editável
 * e os chips de área. Nada passa da largura da tela, mesmo com 300 caracteres ou uma palavra de 80 sem espaços.
 */
export function ListaAprendi({ itens, aoEditar, desabilitado, mostrarErros }: Props) {
  return (
    <section className="aprendi" aria-labelledby="aprendi-titulo" data-aprendi>
      <h2 id="aprendi-titulo" className="aprendi__titulo">
        O que aprendi sobre você
      </h2>
      {itens.length === 0 ? (
        <p className="texto-2">Não encontrei nada novo para guardar.</p>
      ) : (
        <>
          <p className="texto-2">Desmarque o que não quiser guardar e corrija o que precisar.</p>
          <ul className="aprendi__lista">
            {itens.map((i, n) => {
              const erro = mostrarErros ? erroDoItem(i) : null;
              const contador = contadorTexto(i.texto);
              return (
                <li key={i.id} className="aprendi__item" data-marcado={i.marcado} data-item-id={i.id}>
                  <label className="aprendi__caixa">
                    <input type="checkbox" checked={i.marcado} disabled={desabilitado} aria-label={`Guardar a memória ${n + 1}`} onChange={(e) => aoEditar(i.id, { marcado: e.target.checked })} />
                  </label>
                  <div className="aprendi__corpo">
                    <CampoTexto item={i} indice={n} desabilitado={desabilitado} aoMudar={(texto) => aoEditar(i.id, { texto })} />
                    {contador.perto && <p className="aprendi__contador texto-2">{contador.rotulo}</p>}
                    <div className="chips-area" role="radiogroup" aria-label={`Área da memória ${n + 1}`}>
                      {AREAS_MEMORIA.map((a) => (
                        <button key={a} type="button" role="radio" aria-checked={i.area === a} className="chip-area" disabled={desabilitado} onClick={() => aoEditar(i.id, { area: a })}>
                          {ROTULO_AREA[a]}
                        </button>
                      ))}
                    </div>
                    {erro && (
                      <p className="mensagem-erro aprendi__erro" role="alert">
                        {erro}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
