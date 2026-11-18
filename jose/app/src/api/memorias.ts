import type { MemoriaEntrada } from '@compartilhado/schemas';
import { api } from './cliente';

export interface MemoriaDto {
  id: string;
  texto: string;
  area: MemoriaEntrada['area'];
  origem: 'boas_vindas' | 'chat' | 'manual';
  criada_em: string;
  atualizada_em: string | null;
}

export const listarMemorias = () => api.get<MemoriaDto[]>('/api/memorias');
export const criarMemoria = (m: MemoriaEntrada) => api.post<MemoriaDto>('/api/memorias', m);
export const editarMemoria = (id: string, campos: Partial<MemoriaEntrada>) => api.patch<MemoriaDto>(`/api/memorias/${encodeURIComponent(id)}`, campos);
export const apagarMemoria = (id: string) => api.delete(`/api/memorias/${encodeURIComponent(id)}`);
