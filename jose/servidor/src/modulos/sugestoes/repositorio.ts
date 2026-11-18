export interface SugestaoLinha {
  id: string;
  mensagem_id: string;
  tipo: 'tarefa' | 'meta' | 'memoria';
  conteudo: string;
  status: 'pendente' | 'salva' | 'descartada';
  item_id: string | null;
  criada_em: string;
}

/** Tipo da conversa de origem (define a `origem` do item salvo). Posse já checada por quem chama. */
export async function tipoDaConversa(db: D1Database, mensagemId: string): Promise<'normal' | 'boas_vindas'> {
  const linha = await db
    .prepare('SELECT c.tipo FROM conversas c JOIN mensagens m ON m.conversa_id = c.id WHERE m.id = ?')
    .bind(mensagemId)
    .first<{ tipo: 'normal' | 'boas_vindas' }>();
  return linha?.tipo ?? 'normal';
}

/**
 * Reserva a sugestão: pendente → salva, gravando o conteúdo (possivelmente editado) e o id do item.
 * Só uma chamada vence (a condição `status = 'pendente'` está no próprio UPDATE); devolve false para as demais.
 */
export async function reservarSugestao(db: D1Database, id: string, conteudo: unknown, itemId: string): Promise<boolean> {
  const r = await db
    .prepare("UPDATE sugestoes SET status = 'salva', conteudo = ?, item_id = ? WHERE id = ? AND status = 'pendente'")
    .bind(JSON.stringify(conteudo), itemId, id)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

/** Desfaz a reserva quando o item não pôde ser criado. */
export async function liberarSugestao(db: D1Database, id: string, itemId: string): Promise<void> {
  await db.prepare("UPDATE sugestoes SET status = 'pendente', item_id = NULL WHERE id = ? AND item_id = ?").bind(id, itemId).run();
}

export async function descartarSugestao(db: D1Database, id: string): Promise<boolean> {
  const r = await db.prepare("UPDATE sugestoes SET status = 'descartada' WHERE id = ? AND status = 'pendente'").bind(id).run();
  return (r.meta?.changes ?? 0) > 0;
}

/** As sugestões `ids` que pertencem à conversa (pelo caminho sugestão → mensagem → conversa). */
export async function sugestoesDaConversaPorIds(db: D1Database, conversaId: string, ids: string[]): Promise<SugestaoLinha[]> {
  if (!ids.length) return [];
  const { results } = await db
    .prepare(
      `SELECT s.* FROM sugestoes s JOIN mensagens m ON m.id = s.mensagem_id WHERE m.conversa_id = ? AND s.id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(conversaId, ...ids)
    .all<SugestaoLinha>();
  return results;
}
