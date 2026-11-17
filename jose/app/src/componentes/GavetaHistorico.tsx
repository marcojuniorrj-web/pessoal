import { useCallback, useEffect, useState } from 'react';
import { ROTULO_GRUPO, agruparPorPeriodo, FUSO_PADRAO } from '@compartilhado/datas';
import type { ConversaResumo } from '@compartilhado/schemas';
import { apagarConversa, listarConversas } from '../api/conversas';
import { apagarComDesfazer, estaPendente } from '../estado/apagar-com-desfazer';
import { Botao } from './Botao';
import { Esqueleto } from './Esqueleto';
import { useToast } from './Toast';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  /** Conversa aberta no Chat (apagá-la leva ao Chat vazio). */
  conversaAtualId: string | null;
  aoAbrir: (id: string) => void;
  aoApagarAtual: () => void;
}

const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_PADRAO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const data = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_PADRAO, day: '2-digit', month: '2-digit' });

/** Gaveta lateral com o Histórico de conversas (telas.md, tela 4). */
export function GavetaHistorico({ aberta, aoFechar, conversaAtualId, aoAbrir, aoApagarAtual }: Props) {
  const toast = useToast();
  const [itens, setItens] = useState<ConversaResumo[] | null>(null);
  const [erro, setErro] = useState(false);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setErro(false);
    setItens(null);
    listarConversas()
      .then((l) => setItens(l.filter((c) => !estaPendente(c.id))))
      .catch(() => setErro(true));
  }, []);

  useEffect(() => {
    if (aberta) carregar();
    else setMenuAbertoId(null);
  }, [aberta, carregar]);

  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberta, aoFechar]);

  if (!aberta) return null;

  const apagar = (c: ConversaResumo) => {
    setMenuAbertoId(null);
    setItens((l) => l?.filter((x) => x.id !== c.id) ?? l);
    if (c.id === conversaAtualId) aoApagarAtual();
    apagarComDesfazer({
      id: c.id,
      mostrar: toast,
      apagar: () => apagarConversa(c.id),
      aoDesfazer: () => setItens((l) => (l ? [...l, c].sort((a, b) => b.atualizada_em.localeCompare(a.atualizada_em)) : l)),
      aoFalhar: () => {
        setItens((l) => (l ? [...l, c].sort((a, b) => b.atualizada_em.localeCompare(a.atualizada_em)) : l));
        toast('Não foi possível apagar.', { rotulo: 'Tentar de novo', aoTocar: () => apagar(c) });
      },
    });
  };

  const grupos = itens ? agruparPorPeriodo(itens, (c) => c.atualizada_em, new Date()) : [];

  return (
    <div className="gaveta-fundo" onClick={aoFechar}>
      <aside className="gaveta" role="dialog" aria-modal="true" aria-label="Histórico de conversas" onClick={(e) => e.stopPropagation()}>
        <header className="gaveta__topo">
          <h2 className="gaveta__titulo">Histórico</h2>
          <Botao variante="link" onClick={aoFechar} aria-label="Fechar histórico">
            ✕
          </Botao>
        </header>
        <div className="gaveta__corpo">
          {erro && (
            <div className="estado-vazio">
              <p className="mensagem-erro">Não foi possível carregar.</p>
              <Botao onClick={carregar}>Tentar de novo</Botao>
            </div>
          )}
          {!erro && itens === null && (
            <div role="status" aria-label="Carregando" style={{ display: 'grid', gap: 12 }}>
              {[0, 1, 2, 3].map((i) => (
                <Esqueleto key={i} altura="52px" />
              ))}
            </div>
          )}
          {!erro && itens?.length === 0 && <p className="texto-2 gaveta__vazio">Nenhuma conversa ainda.</p>}
          {grupos.map((g) => (
            <section key={g.grupo} aria-label={ROTULO_GRUPO[g.grupo]}>
              <h3 className="gaveta__grupo">{g.rotulo}</h3>
              <ul className="gaveta__lista">
                {g.itens.map((c) => (
                  <li key={c.id} className="gaveta__item" data-atual={c.id === conversaAtualId || undefined}>
                    <button type="button" className="gaveta__abrir" onClick={() => aoAbrir(c.id)}>
                      <span className="gaveta__nome">{c.titulo ?? 'Nova conversa'}</span>
                      <span className="gaveta__quando texto-2">{g.grupo === 'hoje' || g.grupo === 'ontem' ? hora.format(new Date(c.atualizada_em)) : data.format(new Date(c.atualizada_em))}</span>
                    </button>
                    <button
                      type="button"
                      className="gaveta__mais"
                      aria-label={`Mais opções de ${c.titulo ?? 'Nova conversa'}`}
                      aria-expanded={menuAbertoId === c.id}
                      onClick={() => setMenuAbertoId(menuAbertoId === c.id ? null : c.id)}
                    >
                      ⋯
                    </button>
                    {menuAbertoId === c.id && (
                      <div className="gaveta__menu" role="menu">
                        <button type="button" role="menuitem" className="gaveta__menu-item" onClick={() => apagar(c)}>
                          Apagar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
