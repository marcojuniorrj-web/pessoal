import type { AreaItem } from '@compartilhado/areas';
import type { MetaAtualizacao, MetaEntrada } from '@compartilhado/schemas';
import { api } from './cliente';

export interface MetaDto {
  id: string;
  titulo: string;
  area: AreaItem;
  prazo: string | null;
  status: 'ativa' | 'concluida';
  concluida_em: string | null;
  origem: 'chat' | 'manual' | 'boas_vindas';
  criada_em: string;
}

/** As ativas (a mais nova primeiro) e, depois, as concluídas mais recentes. */
export const listarMetas = () => api.get<MetaDto[]>('/api/metas');
export const criarMeta = (m: MetaEntrada) => api.post<MetaDto>('/api/metas', m);
export const editarMeta = (id: string, campos: MetaAtualizacao) => api.patch<MetaDto>(`/api/metas/${encodeURIComponent(id)}`, campos);
export const apagarMeta = (id: string) => api.delete(`/api/metas/${encodeURIComponent(id)}`);
