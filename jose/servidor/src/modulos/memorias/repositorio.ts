import type { MemoriaEntrada } from '@compartilhado/schemas';
import { uuidv7 } from '../../compartilhado/id';

export type OrigemMemoria = 'boas_vindas' | 'chat' | 'manual';

export interface MemoriaLinha {
  id: string;
  usuario_id: string;
  texto: string;
  area: MemoriaEntrada['area'];
  origem: OrigemMemoria;
  criada_em: string;
  atualizada_em: string | null;
}

/** O que a API devolve (sem o usuario_id). */
export type MemoriaDto = Omit<MemoriaLinha, 'usuario_id'>;

export const paraDto = (m: MemoriaLinha): MemoriaDto => ({
  id: m.id, texto: m.texto, area: m.area, origem: m.origem, criada_em: m.criada_em, atualizada_em: m.atualizada_em,
});

/** Mais novas primeiro. */
export async function listarMemorias(db: D1Database, usuarioId: string): Promise<MemoriaLinha[]> {
  const { results } = await db
    .prepare('SELECT * FROM memorias WHERE usuario_id = ? ORDER BY criada_em DESC, rowid DESC')
    .bind(usuarioId)
    .all<MemoriaLinha>();
  return results;
}

export async function inserirMemoria(db: D1Database, usuarioId: string, m: MemoriaEntrada, origem: OrigemMemoria, agora: Date, id: string = uuidv7(agora.getTime())): Promise<MemoriaLinha> {
  const iso = agora.toISOString();
  await db
    .prepare('INSERT INTO memorias (id, usuario_id, texto, area, origem, criada_em, atualizada_em) VALUES (?, ?, ?, ?, ?, ?, NULL)')
    .bind(id, usuarioId, m.texto, m.area, origem, iso)
    .run();
  return { id, usuario_id: usuarioId, texto: m.texto, area: m.area, origem, criada_em: iso, atualizada_em: null };
}

export async function atualizarMemoria(db: D1Database, id: string, usuarioId: string, campos: Partial<MemoriaEntrada>, agora: Date): Promise<void> {
  await db
    .prepare('UPDATE memorias SET texto = COALESCE(?, texto), area = COALESCE(?, area), atualizada_em = ? WHERE id = ? AND usuario_id = ?')
    .bind(campos.texto ?? null, campos.area ?? null, agora.toISOString(), id, usuarioId)
    .run();
}

export async function apagarMemoria(db: D1Database, id: string, usuarioId: string): Promise<void> {
  await db.prepare('DELETE FROM memorias WHERE id = ? AND usuario_id = ?').bind(id, usuarioId).run();
}
