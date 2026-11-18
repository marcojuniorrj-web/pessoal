// Metas (dados.md, entidade Meta). Toda consulta filtra por usuario_id.
import type { MetaEntrada } from '@compartilhado/schemas';
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
