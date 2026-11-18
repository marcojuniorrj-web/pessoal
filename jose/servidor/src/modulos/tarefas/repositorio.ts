// Tarefas (dados.md, entidade Tarefa). Toda consulta filtra por usuario_id; a ordenação da regra 5 fica em compartilhado/ordenacao.ts.
import { ordenarConcluidas, ordenarPendentes } from '@compartilhado/ordenacao';
import type { TarefaAtualizacao, TarefaEntrada } from '@compartilhado/schemas';
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

/** Quantas concluídas a listagem devolve (as mais recentes): a seção "Concluídas" não cresce sem limite. */
export const LIMITE_CONCLUIDAS = 100;

/** Todas as tarefas do usuário, a mais nova primeiro (rowid decrescente): a ordenação estável da regra 5 parte daqui. */
async function todas(db: D1Database, usuarioId: string, concluida: 0 | 1): Promise<TarefaLinha[]> {
  const { results } = await db
    .prepare('SELECT * FROM tarefas WHERE usuario_id = ? AND concluida = ? ORDER BY rowid DESC')
    .bind(usuarioId, concluida)
    .all<TarefaLinha>();
  return results;
}

/** Pendentes na ordem da regra 5 (hoje no fuso do usuário). */
export async function listarPendentes(db: D1Database, usuarioId: string, agora: Date, fuso: string): Promise<TarefaLinha[]> {
  return ordenarPendentes(await todas(db, usuarioId, 0), agora, fuso);
}

/** Pendentes na ordem da regra 5, seguidas das `LIMITE_CONCLUIDAS` concluídas mais recentes (por `concluida_em` decrescente). */
export async function listarTarefas(db: D1Database, usuarioId: string, agora: Date, fuso: string): Promise<TarefaLinha[]> {
  const [pendentes, concluidas] = await Promise.all([listarPendentes(db, usuarioId, agora, fuso), todas(db, usuarioId, 1)]);
  return [...pendentes, ...ordenarConcluidas(concluidas).slice(0, LIMITE_CONCLUIDAS)];
}

export async function atualizarTarefa(db: D1Database, atual: TarefaLinha, campos: TarefaAtualizacao, agora: Date): Promise<void> {
  const sets: string[] = [];
  const valores: Array<string | number | null> = [];
  if (campos.titulo !== undefined) { sets.push('titulo = ?'); valores.push(campos.titulo); }
  if (campos.area !== undefined) { sets.push('area = ?'); valores.push(campos.area); }
  if (campos.prazo !== undefined) { sets.push('prazo = ?'); valores.push(campos.prazo); }
  if (campos.concluida === true && atual.concluida === 0) { sets.push('concluida = 1', 'concluida_em = ?'); valores.push(agora.toISOString()); }
  // Reabrir limpa o instante de conclusão; concluir uma tarefa já concluída mantém o instante original.
  if (campos.concluida === false) sets.push('concluida = 0', 'concluida_em = NULL');
  if (!sets.length) return;
  await db.prepare(`UPDATE tarefas SET ${sets.join(', ')} WHERE id = ? AND usuario_id = ?`).bind(...valores, atual.id, atual.usuario_id).run();
}

export async function apagarTarefa(db: D1Database, id: string, usuarioId: string): Promise<void> {
  await db.prepare('DELETE FROM tarefas WHERE id = ? AND usuario_id = ?').bind(id, usuarioId).run();
}
