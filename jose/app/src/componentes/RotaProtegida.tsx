import { Navigate, useLocation } from 'react-router-dom';
import { useSessao } from '../estado/sessao';
import { EsqueletoLista } from './Esqueleto';
import { Casca } from './Casca';

/**
 * Guarda de rota: sem sessão (401) leva ao Login guardando a rota de volta.
 * `semAbas`: só a tela de Boas-vindas (por desenho) dispensa a barra de abas; todas as outras rotas a mostram.
 */
export function RotaProtegida({ semAbas = false }: { semAbas?: boolean }) {
  const { estado } = useSessao();
  const local = useLocation();
  if (estado.situacao === 'carregando') return <EsqueletoLista />;
  if (estado.situacao === 'deslogado') {
    const params = new URLSearchParams();
    const volta = local.pathname + (new URLSearchParams(local.search).has('erro') ? '' : local.search);
    if (volta !== '/') params.set('voltar', volta);
    const erro = new URLSearchParams(local.search).get('erro');
    if (erro) params.set('erro', erro);
    const qs = params.toString();
    return <Navigate to={`/login${qs ? `?${qs}` : ''}`} replace />;
  }
  return <Casca semAbas={semAbas} />;
}
