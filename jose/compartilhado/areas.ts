// Único mapa de rótulos das áreas, usado em todas as telas (telas.md).
export const AREAS_ITEM = ['trabalho', 'financas', 'saude', 'casa'] as const;
export const AREAS_MEMORIA = ['sobre_mim', ...AREAS_ITEM] as const;

export type AreaItem = (typeof AREAS_ITEM)[number];
export type AreaMemoria = (typeof AREAS_MEMORIA)[number];

export const ROTULO_AREA: Record<AreaMemoria, string> = {
  sobre_mim: 'Sobre mim',
  trabalho: 'Trabalho',
  financas: 'Finanças',
  saude: 'Saúde e rotina',
  casa: 'Família e casa',
};

export function rotuloArea(area: AreaMemoria): string {
  return ROTULO_AREA[area];
}
