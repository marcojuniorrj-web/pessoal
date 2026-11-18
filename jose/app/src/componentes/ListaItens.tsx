import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AreaItem } from '@compartilhado/areas';
import type { ConteudoItem } from '../estado/item-edicao';
import { posicionarMenu } from '../estado/menu-posicao';
import { prazoDaTarefa, rotuloPrazo } from '../estado/prazo';
import { Botao } from './Botao';
import { EtiquetaArea } from './EtiquetaArea';
import { FormItem } from './FormItem';

export interface ItemDaLista {
  id: string;
  titulo: string;
  area: AreaItem;
  prazo: string | null;
}

interface Props<T extends ItemDaLista> {
  tipo: 'tarefa' | 'meta';
  pendentes: T[];
  concluidas: T[];
  agora: Date;
  fuso: string;
  /** Sem internet: a lista fica só para leitura. */
  semRede: boolean;
  aoConcluir: (item: T) => void;
  aoReabrir: (item: T) => void;
  aoEditar: (item: T, novo: ConteudoItem) => Promise<void>;
  aoCriar: (novo: ConteudoItem) => Promise<void>;
  aoApagar: (item: T) => void;
  /** Mostrado quando não há nenhum item (nem concluído), no lugar da lista. */
  vazio: ReactNode;
}

/**
 * Lista de tarefas ou de metas (telas.md, tela 5): círculo de concluir, título (toque para editar), área, prazo e ⋯ Apagar;
 * "+ Adicionar" e a seção recolhida "Concluídas". Tarefas e metas usam a mesma lista; só mudam os rótulos e o texto do prazo.
 */
export function ListaItens<T extends ItemDaLista>({ tipo, pendentes, concluidas, agora, fuso, semRede, aoConcluir, aoReabrir, aoEditar, aoCriar, aoApagar, vazio }: Props<T>) {
  const [adicionando, setAdicionando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const nome = tipo === 'tarefa' ? 'tarefa' : 'meta';

  // Quem abriu o formulário recebe o foco de volta quando ele fecha por Esc, Cancelar ou Salvar.
  const voltarFoco = useRef<string | null>(null);
  useEffect(() => {
    if (adicionando || editandoId || !voltarFoco.current) return;
    const alvo = voltarFoco.current;
    voltarFoco.current = null;
    document.querySelector<HTMLElement>(alvo)?.focus();
  }, [adicionando, editandoId]);
  const fecharAdicionar = () => { voltarFoco.current = '.itens__adicionar'; setAdicionando(false); };
  const fecharEdicao = (id: string) => { voltarFoco.current = `[data-item-id="${id}"] .item__abrir`; setEditandoId(null); };

  // Menu ⋯: Esc fecha (o foco volta ao ⋯) e tocar fora dele também fecha.
  useEffect(() => {
    if (!menuAbertoId) return;
    const id = menuAbertoId;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuAbertoId(null);
      document.querySelector<HTMLElement>(`[data-item-id="${id}"] .item__mais`)?.focus();
    };
    const aoTocar = (e: PointerEvent) => {
      const alvo = e.target as Element | null;
      if (!alvo?.closest(`[data-item-id="${id}"] .item__menu, [data-item-id="${id}"] .item__mais`)) setMenuAbertoId(null);
    };
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoTocar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoTocar);
    };
  }, [menuAbertoId]);

  const linha = (item: T, feita: boolean) => {
    const prazo = item.prazo ? (tipo === 'tarefa' && !feita ? prazoDaTarefa(item.prazo, agora, fuso) : { texto: rotuloPrazo(item.prazo, agora, fuso), situacao: 'futura' as const }) : null;
    return (
      <li key={item.id} className="item" data-item-id={item.id} data-feita={feita || undefined} data-situacao={prazo?.situacao}>
        {editandoId === item.id ? (
          <FormItem
            titulo={`Editar ${nome}`}
            tipo={tipo}
            inicial={{ titulo: item.titulo, area: item.area, prazo: item.prazo }}
            rotuloSalvar="Salvar"
            aoCancelar={() => fecharEdicao(item.id)}
            aoSalvar={async (novo) => {
              await aoEditar(item, novo);
              fecharEdicao(item.id);
            }}
          />
        ) : (
          <>
            <button
              type="button"
              className="item__circulo"
              disabled={semRede}
              aria-label={`${feita ? 'Reabrir' : 'Concluir'}: ${item.titulo}`}
              onClick={() => (feita ? aoReabrir(item) : aoConcluir(item))}
            >
              <span className="item__marca" aria-hidden="true">
                {feita ? '✓' : ''}
              </span>
            </button>
            <button
              type="button"
              className="item__abrir"
              disabled={semRede}
              aria-label={`Editar: ${item.titulo}`}
              onClick={() => { setAdicionando(false); setMenuAbertoId(null); setEditandoId(item.id); }}
            >
              <span className="item__titulo">{item.titulo}</span>
              <span className="item__meta">
                <EtiquetaArea area={item.area} />
                {prazo && <span className="item__prazo texto-2">{prazo.texto}</span>}
              </span>
            </button>
            <button
              type="button"
              className="item__mais"
              aria-label={`Mais opções de ${item.titulo}`}
              aria-expanded={menuAbertoId === item.id}
              onClick={() => setMenuAbertoId(menuAbertoId === item.id ? null : item.id)}
            >
              ⋯
            </button>
            {menuAbertoId === item.id && (
              <div className="item__menu" role="menu" ref={posicionarMenu}>
                <button type="button" role="menuitem" className="item__menu-item" disabled={semRede} onClick={() => { setMenuAbertoId(null); aoApagar(item); }}>
                  Apagar
                </button>
              </div>
            )}
          </>
        )}
      </li>
    );
  };

  const total = pendentes.length + concluidas.length;
  return (
    <div className="itens">
      {!adicionando && (
        <Botao className="itens__adicionar" disabled={semRede} onClick={() => { setEditandoId(null); setAdicionando(true); }}>
          + Adicionar
        </Botao>
      )}
      {adicionando && (
        <FormItem
          titulo={`Adicionar ${nome}`}
          tipo={tipo}
          rotuloSalvar="Salvar"
          aoCancelar={fecharAdicionar}
          aoSalvar={async (novo) => {
            await aoCriar(novo);
            fecharAdicionar();
          }}
        />
      )}

      {total === 0 && !adicionando && vazio}
      {total > 0 && pendentes.length === 0 && !adicionando && <p className="itens__tudo texto-2">{tipo === 'tarefa' ? 'Nada pendente por aqui.' : 'Nenhuma meta ativa.'}</p>}

      {pendentes.length > 0 && <ul className="itens__lista" aria-label={tipo === 'tarefa' ? 'Tarefas pendentes' : 'Metas ativas'}>{pendentes.map((i) => linha(i, false))}</ul>}

      {concluidas.length > 0 && (
        <section className="itens__concluidas">
          <button type="button" className="itens__alternar" aria-expanded={verConcluidas} onClick={() => setVerConcluidas((v) => !v)}>
            <span aria-hidden="true">{verConcluidas ? '▾' : '▸'}</span> Concluídas ({concluidas.length})
          </button>
          {verConcluidas && <ul className="itens__lista" aria-label={tipo === 'tarefa' ? 'Tarefas concluídas' : 'Metas concluídas'}>{concluidas.map((i) => linha(i, true))}</ul>}
        </section>
      )}
    </div>
  );
}
