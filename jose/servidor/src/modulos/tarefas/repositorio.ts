// Tarefas (dados.md, entidade Tarefa). Toda consulta filtra por usuario_id; a ordenação da regra 5 fica em compartilhado/ordenacao.ts.
import type { TarefaEntrada } from '@compartilhado/schemas';
import { uuidv7 } from '../../compartilhado/id';

export type OrigemItem = 'chat' | 'manual' | 'boas_vindas';

export interface TarefaLinha {
  id: string;
  usuario_id: string;
  titulo: string;
  area: TarefaEntrada['area'];
  prazo: string | null;
  concluida: number;
  concluida_em: string | null;
  origem: OrigemItem;
  criada_em: string;
}

/** O que a API devolve (sem o usuario_id; `concluida` vira booleano). */
export interface TarefaDto {
  id: string;
  titulo: string;
  area: TarefaEntrada['area'];
  prazo: string | null;
  concluida: boolean;
  concluida_em: string | null;
  origem: OrigemItem;
  criada_em: string;
}

export const paraDto = (t: TarefaLinha): TarefaDto => ({
  id: t.id, titulo: t.titulo, area: t.area, prazo: t.prazo, concluida: t.concluida === 1, concluida_em: t.concluida_em, origem: t.origem, criada_em: t.criada_em,
});

export async function inserirTarefa(db: D1Database, usuarioId: string, t: TarefaEntrada, origem: OrigemItem, agora: Date, id: string = uuidv7(agora.getTime())): Promise<TarefaLinha> {
  const iso = agora.toISOString();
  const prazo = t.prazo ?? null;
  await db
    .prepare('INSERT INTO tarefas (id, usuario_id, titulo, area, prazo, concluida, concluida_em, origem, criada_em) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)')
    .bind(id, usuarioId, t.titulo, t.area, prazo, origem, iso)
    .run();
  return { id, usuario_id: usuarioId, titulo: t.titulo, area: t.area, prazo, concluida: 0, concluida_em: null, origem, criada_em: iso };
}
