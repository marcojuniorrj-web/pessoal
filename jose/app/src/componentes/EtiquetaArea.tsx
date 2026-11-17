import { ROTULO_AREA, type AreaMemoria } from '@compartilhado/areas';

export function EtiquetaArea({ area }: { area: AreaMemoria }) {
  return <span className={`etiqueta-area etiqueta-area--${area}`}>{ROTULO_AREA[area]}</span>;
}
