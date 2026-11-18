import type { MemoriaEntrada } from '@compartilhado/schemas';
import { api } from './cliente';
import type { MemoriaDto } from './memorias';

export type ConteudoSugestao = MemoriaEntrada;

/** Salva a sugestão (com o conteúdo editado, se houver). 409 = já tratada. */
export const salvarSugestao = (id: string, conteudo?: ConteudoSugestao) =>
  api.post<{ item: MemoriaDto }>(`/api/sugestoes/${encodeURIComponent(id)}/salvar`, conteudo ? { conteudo } : undefined);

export const descartarSugestao = (id: string) => api.post(`/api/sugestoes/${encodeURIComponent(id)}/descartar`);
