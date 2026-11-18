import { Navigate, useSearchParams } from 'react-router-dom';
import { destinoInicial } from '../estado/boas-vindas';
import { useUsuario } from '../estado/sessao';
import { Chat } from './Chat';

/** Rota "/": com as boas-vindas não concluídas leva a elas; concluídas (ou com conversa/Chat novo pedido), abre o Chat. */
export function Inicio() {
  const usuario = useUsuario();
  const [params] = useSearchParams();
  const destino = destinoInicial(usuario, { c: params.get('c'), nova: params.get('nova') === '1' });
  return destino === 'boas-vindas' ? <Navigate to="/boas-vindas" replace /> : <Chat />;
}
