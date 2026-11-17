import type { ConversaCompleta, ConversaDto, ConversaResumo, MensagemDto, SugestaoDto } from '@compartilhado/schemas';
import { uuidv7 } from '../../compartilhado/id';

export interface ConversaLinha extends ConversaDto {
  usuario_id: string;
}
export interface MensagemLinha extends MensagemDto {
  conversa_id: string;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  tokens_cache: number | null;
}
interface SugestaoLinha extends Omit<SugestaoDto, 'conteudo'> {
  conteudo: string;
}

export const paraDto = (c: ConversaLinha): ConversaDto => ({
  id: c.id, titulo: c.titulo, tipo: c.tipo, modo: c.modo, criada_em: c.criada_em, atualizada_em: c.atualizada_em,
});

export async function criarConversa(db: D1Database, usuarioId: string, tipo: ConversaDto['tipo'], modo: ConversaDto['modo'], agora: Date): Promise<string> {
  const id = uuidv7(agora.getTime());
  const iso = agora.toISOString();
  await db
    .prepare('INSERT INTO conversas (id, usuario_id, titulo, tipo, modo, criada_em, atualizada_em) VALUES (?, ?, NULL, ?, ?, ?, ?)')
    .bind(id, usuarioId, tipo, modo, iso, iso)
    .run();
  return id;
}

export async function listarConversas(db: D1Database, usuarioId: string): Promise<ConversaResumo[]> {
  const { results } = await db
    .prepare('SELECT id, titulo, tipo, modo, atualizada_em FROM conversas WHERE usuario_id = ? ORDER BY atualizada_em DESC, rowid DESC')
    .bind(usuarioId)
    .all<ConversaResumo>();
  return results;
}

/** Última conversa `normal` (a regra 12 compara o dia dela com hoje, no serviço). */
export async function ultimaConversaNormal(db: D1Database, usuarioId: string) {
  return db
    .prepare("SELECT * FROM conversas WHERE usuario_id = ? AND tipo = 'normal' ORDER BY atualizada_em DESC, rowid DESC LIMIT 1")
    .bind(usuarioId)
    .first<ConversaLinha>();
}

export async function mensagensDaConversa(db: D1Database, conversaId: string): Promise<MensagemLinha[]> {
  const { results } = await db
    .prepare('SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY criada_em ASC, rowid ASC')
    .bind(conversaId)
    .all<MensagemLinha>();
  return results;
}

export async function sugestoesDaConversa(db: D1Database, conversaId: string): Promise<SugestaoDto[]> {
  const { results } = await db
    .prepare(
      'SELECT s.id, s.mensagem_id, s.tipo, s.conteudo, s.status, s.item_id FROM sugestoes s JOIN mensagens m ON m.id = s.mensagem_id WHERE m.conversa_id = ? ORDER BY s.criada_em ASC, s.rowid ASC',
    )
    .bind(conversaId)
    .all<SugestaoLinha>();
  return results.map((s) => ({ ...s, conteudo: JSON.parse(s.conteudo) as unknown }));
}

export const mensagemParaDto = (m: MensagemLinha): MensagemDto => ({
  id: m.id, autor: m.autor, texto: m.texto, origem: m.origem, modelo: m.modelo, criada_em: m.criada_em,
});

export async function conversaCompleta(db: D1Database, conversa: ConversaLinha): Promise<ConversaCompleta> {
  const [mensagens, sugestoes] = await Promise.all([mensagensDaConversa(db, conversa.id), sugestoesDaConversa(db, conversa.id)]);
  return { conversa: paraDto(conversa), mensagens: mensagens.map(mensagemParaDto), sugestoes };
}

/** A cascata apaga mensagens e sugestões; tarefas, metas e memórias já salvas permanecem. */
export async function apagarConversa(db: D1Database, conversaId: string): Promise<void> {
  await db.prepare('DELETE FROM conversas WHERE id = ?').bind(conversaId).run();
}
