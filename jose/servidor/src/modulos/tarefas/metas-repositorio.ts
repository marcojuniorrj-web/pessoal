// Metas (dados.md, entidade Meta). Toda consulta filtra por usuario_id.
import { ordenarConcluidas, ordenarMaisNovaPrimeiro } from '@compartilhado/ordenacao';
import type { MetaAtualizacao, MetaEntrada } from '@compartilhado/schemas';
import { uuidv7 } from '../../compartilhado/id';
import type { OrigemItem } from './repositorio';

export interface MetaLinha {
  id: string;
  usuario_id: string;
  titulo: string;
  area: MetaEntrada['area'];
  prazo: string | null;
  status: 'ativa' | 'concluida';
  concluida_em: string | null;
  origem: OrigemItem;
  criada_em: string;
}

/** O que a API devolve (sem o usuario_id). */
export type MetaDto = Omit<MetaLinha, 'usuario_id'>;

export const paraDto = (m: MetaLinha): MetaDto => ({
  id: m.id, titulo: m.titulo, area: m.area, prazo: m.prazo, status: m.status, concluida_em: m.concluida_em, origem: m.origem, criada_em: m.criada_em,
});

export async function inserirMeta(db: D1Database, usuarioId: string, m: MetaEntrada, origem: OrigemItem, agora: Date, id: string = uuidv7(agora.getTime())): Promise<MetaLinha> {
  const iso = agora.toISOString();
  const prazo = m.prazo ?? null;
  await db
    .prepare("INSERT INTO metas (id, usuario_id, titulo, area, prazo, status, concluida_em, origem, criada_em) VALUES (?, ?, ?, ?, ?, 'ativa', NULL, ?, ?)")
    .bind(id, usuarioId, m.titulo, m.area, prazo, origem, iso)
    .run();
  return { id, usuario_id: usuarioId, titulo: m.titulo, area: m.area, prazo, status: 'ativa', concluida_em: null, origem, criada_em: iso };
}

/** Quantas concluídas a listagem devolve (as mais recentes). */
export const LIMITE_METAS_CONCLUIDAS = 100;

/**
 * Lista simples (dados.md não define ordem para metas): as ativas, a mais nova primeiro, seguidas das concluídas
 * mais recentes (por `concluida_em` decrescente).
 */
export async function listarMetas(db: D1Database, usuarioId: string): Promise<MetaLinha[]> {
  const { results } = await db.prepare('SELECT * FROM metas WHERE usuario_id = ? ORDER BY rowid DESC').bind(usuarioId).all<MetaLinha>();
  const ativas = ordenarMaisNovaPrimeiro(results.filter((m) => m.status === 'ativa'));
  const concluidas = ordenarConcluidas(results.filter((m) => m.status === 'concluida')).slice(0, LIMITE_METAS_CONCLUIDAS);
  return [...ativas, ...concluidas];
}

export async function atualizarMeta(db: D1Database, atual: MetaLinha, campos: MetaAtualizacao, agora: Date): Promise<void> {
  const sets: string[] = [];
  const valores: Array<string | null> = [];
  if (campos.titulo !== undefined) { sets.push('titulo = ?'); valores.push(campos.titulo); }
  if (campos.area !== undefined) { sets.push('area = ?'); valores.push(campos.area); }
  if (campos.prazo !== undefined) { sets.push('prazo = ?'); valores.push(campos.prazo); }
  // Concluir grava o instante (uma meta já concluída mantém o original); reativar limpa.
  if (campos.status === 'concluida' && atual.status !== 'concluida') { sets.push("status = 'concluida'", 'concluida_em = ?'); valores.push(agora.toISOString()); }
  if (campos.status === 'ativa') sets.push("status = 'ativa'", 'concluida_em = NULL');
  if (!sets.length) return;
  await db.prepare(`UPDATE metas SET ${sets.join(', ')} WHERE id = ? AND usuario_id = ?`).bind(...valores, atual.id, atual.usuario_id).run();
}

export async function apagarMeta(db: D1Database, id: string, usuarioId: string): Promise<void> {
  await db.prepare('DELETE FROM metas WHERE id = ? AND usuario_id = ?').bind(id, usuarioId).run();
}
