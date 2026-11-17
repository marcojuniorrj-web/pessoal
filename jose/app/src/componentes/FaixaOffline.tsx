import { useOnline } from '../estado/online';
import { useSessao } from '../estado/sessao';

/** Aparece quando o navegador diz que está offline OU quando a última chamada ao servidor falhou
 * por rede (no iPhone o `navigator.onLine` nem sempre é confiável). */
export function FaixaOffline() {
  const online = useOnline();
  const { estado } = useSessao();
  const semRede = !online || (estado.situacao === 'logado' && estado.offline);
  if (!semRede) return null;
  return (
    <div className="faixa-offline" role="status">
      Offline
    </div>
  );
}
