// Estado de uma lista carregada da API (Tarefas e Metas): carga, itens e as mutações otimistas (adicionar, trocar, remover).
import { useCallback, useEffect, useState } from 'react';
import { ErroRede } from '../api/cliente';
import { estaPendente } from './apagar-com-desfazer';
import { lerCacheLista, salvarCacheLista } from './cache-lista';

export type Carga = 'carregando' | 'ok' | 'erro';

/**
 * `chavePendente(id)`: chave do "Desfazer" de apagar; um item apagado com o aviso ainda no ar fica fora da lista.
 * `chaveCache`: nome sob o qual a última lista carregada fica guardada; sem rede (falha de conexão) a tela abre com ela, só para leitura.
 */
export function useListaRemota<T extends { id: string }>(listar: () => Promise<T[]>, chavePendente: (id: string) => string, chaveCache: string) {
  const [carga, setCarga] = useState<Carga>('carregando');
  const [itens, setItens] = useState<T[]>([]);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCarga('carregando');
    listar()
      .then((lista) => {
        if (cancelado) return;
        salvarCacheLista(chaveCache, lista);
        setItens(lista.filter((i) => !estaPendente(chavePendente(i.id))));
        setCarga('ok');
      })
      .catch((e) => {
        if (cancelado) return;
        const cache = e instanceof ErroRede ? lerCacheLista<T>(chaveCache) : null;
        if (cache) {
          setItens(cache.filter((i) => !estaPendente(chavePendente(i.id))));
          setCarga('ok');
        } else setCarga('erro');
      });
    return () => {
      cancelado = true;
    };
    // `listar` e `chavePendente` são funções estáveis do módulo (não entram nas dependências de propósito).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);
  // A lista guardada acompanha as mudanças feitas aqui (senão abrir offline mostraria uma lista velha).
  const mudar = useCallback((f: (l: T[]) => T[]) => setItens((l) => {
    const nova = f(l);
    salvarCacheLista(chaveCache, nova);
    return nova;
  }), [chaveCache]);
  /** O novo item vai para a frente (a ordenação fica por conta de quem exibe). */
  const adicionar = useCallback((i: T) => mudar((l) => [i, ...l.filter((x) => x.id !== i.id)]), [mudar]);
  const substituir = useCallback((i: T) => mudar((l) => l.map((x) => (x.id === i.id ? i : x))), [mudar]);
  const remover = useCallback((id: string) => mudar((l) => l.filter((x) => x.id !== id)), [mudar]);

  return { carga, itens, recarregar, adicionar, substituir, remover };
}
