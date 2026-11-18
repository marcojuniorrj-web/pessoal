import type { AreaItem } from '@compartilhado/areas';
import type { TarefaAtualizacao, TarefaEntrada } from '@compartilhado/schemas';
import { api } from './cliente';

export interface TarefaDto {
  id: string;
  titulo: string;
  area: AreaItem;
  prazo: string | null;
  concluida: boolean;
  concluida_em: string | null;
  origem: 'chat' | 'manual' | 'boas_vindas';
  criada_em: string;
}

/** Pendentes na ordem da regra 5 e, depois, as concluídas mais recentes. */
export const listarTarefas = () => api.get<TarefaDto[]>('/api/tarefas');
export const criarTarefa = (t: TarefaEntrada) => api.post<TarefaDto>('/api/tarefas', t);
export const editarTarefa = (id: string, campos: TarefaAtualizacao) => api.patch<TarefaDto>(`/api/tarefas/${encodeURIComponent(id)}`, campos);
export const apagarTarefa = (id: string) => api.delete(`/api/tarefas/${encodeURIComponent(id)}`);
