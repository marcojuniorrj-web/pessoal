import { useOnline } from '../estado/online';

export function FaixaOffline() {
  if (useOnline()) return null;
  return (
    <div className="faixa-offline" role="status">
      Offline
    </div>
  );
}
