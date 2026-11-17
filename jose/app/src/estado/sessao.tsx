import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Usuario } from '@compartilhado/schemas';
import { api, ErroHttp, ErroRede } from '../api/cliente';

type Estado =
  | { situacao: 'carregando' }
  | { situacao: 'deslogado' }
  | { situacao: 'logado'; usuario: Usuario; offline: boolean };

interface ContextoSessao {
  estado: Estado;
  /** Chamado quando qualquer chamada da API devolve 401. */
  sessaoExpirou: () => void;
  recarregar: () => void;
}

const CHAVE_CACHE = 'jose:eu';
const Contexto = createContext<ContextoSessao | null>(null);

function lerCache(): Usuario | null {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CACHE) ?? 'null') as Usuario | null;
  } catch {
    return null;
  }
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ situacao: 'carregando' });

  const carregar = useCallback(async () => {
    try {
      const eu = await api.get<Usuario>('/api/eu');
      localStorage.setItem(CHAVE_CACHE, JSON.stringify(eu));
      setEstado({ situacao: 'logado', usuario: eu, offline: false });
    } catch (e) {
      if (e instanceof ErroHttp && e.status === 401) {
        localStorage.removeItem(CHAVE_CACHE);
        setEstado({ situacao: 'deslogado' });
      } else if (e instanceof ErroRede) {
        // Offline: abre com o último usuário conhecido, só para leitura.
        const cache = lerCache();
        setEstado(cache ? { situacao: 'logado', usuario: cache, offline: true } : { situacao: 'deslogado' });
      } else {
        setEstado({ situacao: 'deslogado' });
      }
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const valor = useMemo<ContextoSessao>(
    () => ({
      estado,
      sessaoExpirou: () => {
        localStorage.removeItem(CHAVE_CACHE);
        setEstado({ situacao: 'deslogado' });
      },
      recarregar: () => void carregar(),
    }),
    [estado, carregar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSessao fora do SessaoProvider');
  return c;
}

/** Usuário logado (só dentro de rotas protegidas). */
export function useUsuario(): Usuario {
  const { estado } = useSessao();
  if (estado.situacao !== 'logado') throw new Error('sem usuário');
  return estado.usuario;
}
