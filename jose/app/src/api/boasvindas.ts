import type { MemoriaEntrada } from '@compartilhado/schemas';
import { api } from './cliente';
import type { MemoriaDto } from './memorias';

/** Cria a conversa de boas-vindas (o servidor já grava a 1ª pergunta fixa). */
export const criarConversaBoasVindas = () => api.post<{ id: string }>('/api/conversas', { tipo: 'boas_vindas' });

export interface LoteBoasVindas {
  salvar: Array<{ id: string; conteudo?: MemoriaEntrada }>;
  descartar: string[];
}

/** "Salvar selecionadas": numa transação o servidor salva, descarta e conclui as boas-vindas. */
export const salvarLote = (conversaId: string, lote: LoteBoasVindas) =>
  api.post<{ itens: MemoriaDto[] }>(`/api/conversas/${encodeURIComponent(conversaId)}/sugestoes/lote`, lote);

/** Pular (ou concluir sem lista): marca as boas-vindas como concluídas. */
export const concluirBoasVindas = () => api.post('/api/eu/boas-vindas');
