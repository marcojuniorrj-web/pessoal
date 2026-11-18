import type { MemoriaEntrada, MetaEntrada, TarefaEntrada } from '@compartilhado/schemas';
import { api } from './cliente';
import type { MemoriaDto } from './memorias';
import type { MetaDto } from './metas';
import type { TarefaDto } from './tarefas';

export type ConteudoSugestao = MemoriaEntrada | TarefaEntrada | MetaEntrada;
/** O item criado ao salvar: memória, tarefa ou meta (conforme o tipo da sugestão). */
export type ItemSalvo = MemoriaDto | TarefaDto | MetaDto;

/** Salva a sugestão (com o conteúdo editado, se houver). 409 = já tratada. */
export const salvarSugestao = (id: string, conteudo?: ConteudoSugestao) =>
  api.post<{ item: ItemSalvo }>(`/api/sugestoes/${encodeURIComponent(id)}/salvar`, conteudo ? { conteudo } : undefined);

export const descartarSugestao = (id: string) => api.post(`/api/sugestoes/${encodeURIComponent(id)}/descartar`);
