// Estado da aba José sabe: lista de memórias agrupada por área, com as mutações otimistas (criar, editar, apagar).
import { useCallback, useEffect, useState } from 'react';
import { AREAS_MEMORIA, ROTULO_AREA, type AreaMemoria } from '@compartilhado/areas';
import { FUSO_PADRAO } from '@compartilhado/datas';
import { listarMemorias, type MemoriaDto } from '../api/memorias';
import { estaPendente } from './apagar-com-desfazer';

export interface GrupoMemorias {
  area: AreaMemoria;
  rotulo: string;
  itens: MemoriaDto[];
}

/** Mais novas primeiro (criada_em; empate pelo id, que é uuid v7 e cresce com o tempo). */
export const maisNovaPrimeiro = (a: MemoriaDto, b: MemoriaDto) => b.criada_em.localeCompare(a.criada_em) || b.id.localeCompare(a.id);

/** Grupos na ordem das áreas do telas.md (Sobre mim, Trabalho, Finanças, Saúde e rotina, Família e casa); áreas vazias não aparecem. */
export function agruparMemorias(memorias: MemoriaDto[]): GrupoMemorias[] {
  return AREAS_MEMORIA.map((area) => ({ area, rotulo: ROTULO_AREA[area], itens: memorias.filter((m) => m.area === area).sort(maisNovaPrimeiro) })).filter((g) => g.itens.length > 0);
}

/** "18/11/2026" no fuso do Marco (a data em que o José aprendeu). */
export function formatarDataMemoria(iso: string, fuso: string = FUSO_PADRAO): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

export type CargaMemorias = 'carregando' | 'ok' | 'erro';

export function useMemorias() {
  const [carga, setCarga] = useState<CargaMemorias>('carregando');
  const [memorias, setMemorias] = useState<MemoriaDto[]>([]);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarga('carregando');
    listarMemorias()
      .then((lista) => {
        if (cancelado) return;
        // Uma memória apagada com "Desfazer" ainda no ar fica fora da lista.
        setMemorias(lista.filter((m) => !estaPendente(`memoria:${m.id}`)));
        setCarga('ok');
      })
      .catch(() => {
        if (!cancelado) setCarga('erro');
      });
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);
  const adicionar = useCallback((m: MemoriaDto) => setMemorias((l) => [m, ...l.filter((x) => x.id !== m.id)]), []);
  const substituir = useCallback((m: MemoriaDto) => setMemorias((l) => l.map((x) => (x.id === m.id ? m : x))), []);
  const remover = useCallback((id: string) => setMemorias((l) => l.filter((x) => x.id !== id)), []);

  return { carga, memorias, recarregar, adicionar, substituir, remover };
}
