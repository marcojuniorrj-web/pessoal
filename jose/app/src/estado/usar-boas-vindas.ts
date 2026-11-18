// Estado da tela de boas-vindas (por cima do Chat): etapa pelas mensagens, a lista "O que aprendi", salvar o lote e pular.
import { useCallback, useMemo, useState } from 'react';
import { etapaBoasVindas, rotuloProgresso, type EtapaBoasVindas } from '@compartilhado/boasvindas';
import { concluirBoasVindas, salvarLote } from '../api/boasvindas';
import { ErroRede } from '../api/cliente';
import type { Bolha } from './chat';
import { montarItens, montarLote, type EdicaoAprendi, type ItemAprendi } from './lista-aprendi';

export type ErroLista = 'rede' | 'outro';

export interface BoasVindasEstado {
  etapa: EtapaBoasVindas;
  /** "Pergunta 3 de 5", "Preparando o resumo…" ou "Revise e confirme". */
  progresso: string;
  itens: ItemAprendi[];
  editar: (id: string, edicao: EdicaoAprendi) => void;
  /** O botão principal da revisão: "Salvar selecionadas" ou, sem nada a guardar, "Concluir". */
  rotuloSalvar: string;
  salvando: boolean;
  erro: ErroLista | null;
  /** Depois de tentar salvar com um texto inválido, os erros dos itens passam a aparecer. */
  mostrarErros: boolean;
  /** Id do 1º item com erro (a tela leva o foco até ele). */
  itemComErro: string | null;
  salvar: () => Promise<void>;
  pulando: boolean;
  erroPular: boolean;
  pular: () => Promise<void>;
}

interface Opcoes {
  conversaId: string;
  bolhas: Bolha[];
  /** As boas-vindas ficaram concluídas (salvou ou pulou): a tela marca a flag e vai ao Chat. */
  aoConcluir: () => void;
}

export function useBoasVindas({ conversaId, bolhas, aoConcluir }: Opcoes): BoasVindasEstado {
  // Só mensagens prontas contam: a resposta do José em andamento ou com erro ainda não é uma mensagem do servidor.
  const prontas = useMemo(() => bolhas.filter((b) => b.estado === 'ok'), [bolhas]);
  const etapa = etapaBoasVindas(prontas);
  const [edicoes, setEdicoes] = useState<Record<string, EdicaoAprendi>>({});
  const itens = useMemo(() => montarItens(prontas.flatMap((b) => b.sugestoes ?? []), edicoes), [prontas, edicoes]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<ErroLista | null>(null);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [itemComErro, setItemComErro] = useState<string | null>(null);
  const [pulando, setPulando] = useState(false);
  const [erroPular, setErroPular] = useState(false);

  const editar = useCallback((id: string, edicao: EdicaoAprendi) => {
    setErro(null);
    setEdicoes((e) => ({ ...e, [id]: { ...e[id], ...edicao } }));
  }, []);

  const salvar = useCallback(async () => {
    if (salvando) return;
    setErro(null);
    setItemComErro(null);
    let lote = null;
    if (itens.length) {
      const r = montarLote(itens);
      if (!r.ok) {
        setMostrarErros(true);
        setItemComErro(r.primeiroComErro);
        return;
      }
      lote = r.lote;
    }
    setSalvando(true);
    try {
      // Com itens: uma única operação no servidor (salva, descarta e conclui). Sem nada a guardar: só conclui.
      if (lote) await salvarLote(conversaId, lote);
      else await concluirBoasVindas();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof ErroRede ? 'rede' : 'outro'); // as marcações e os textos editados continuam como estavam
    } finally {
      setSalvando(false);
    }
  }, [aoConcluir, conversaId, itens, salvando]);

  const pular = useCallback(async () => {
    if (pulando) return;
    setPulando(true);
    setErroPular(false);
    try {
      await concluirBoasVindas();
      aoConcluir();
    } catch {
      setErroPular(true);
    } finally {
      setPulando(false);
    }
  }, [aoConcluir, pulando]);

  const progresso = rotuloProgresso(etapa) ?? (etapa.fase === 'resumindo' ? 'Preparando o resumo…' : 'Revise e confirme');
  return {
    etapa, progresso, itens, editar, salvando, erro, mostrarErros, itemComErro, salvar, pulando, erroPular, pular,
    rotuloSalvar: itens.length ? 'Salvar selecionadas' : 'Concluir',
  };
}
