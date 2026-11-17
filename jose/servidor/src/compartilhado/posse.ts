import { naoEncontrado } from './erros';

const TABELAS_COM_DONO = ['conversas', 'tarefas', 'metas', 'memorias'] as const;
export type TabelaComDono = (typeof TABELAS_COM_DONO)[number];

/**
 * Helper de posse: busca a linha pelo id SOMENTE se for do usuário da sessão.
 * Item inexistente ou de outro usuário dá o mesmo 404 (não revela que existe).
 */
export async function buscarDoUsuario<T>(db: D1Database, tabela: TabelaComDono, id: string, usuarioId: string): Promise<T> {
  if (!TABELAS_COM_DONO.includes(tabela)) throw new Error('tabela sem dono');
  const linha = await db.prepare(`SELECT * FROM ${tabela} WHERE id = ? AND usuario_id = ?`).bind(id, usuarioId).first<T>();
  if (!linha) throw naoEncontrado();
  return linha;
}

/** Posse de uma mensagem pelo caminho mensagem → conversa → usuário. */
export async function buscarMensagemDoUsuario<T>(db: D1Database, mensagemId: string, usuarioId: string): Promise<T> {
  const linha = await db
    .prepare('SELECT m.* FROM mensagens m JOIN conversas c ON c.id = m.conversa_id WHERE m.id = ? AND c.usuario_id = ?')
    .bind(mensagemId, usuarioId)
    .first<T>();
  if (!linha) throw naoEncontrado();
  return linha;
}

/** Posse de uma sugestão pelo caminho sugestão → mensagem → conversa → usuário. */
export async function buscarSugestaoDoUsuario<T>(db: D1Database, sugestaoId: string, usuarioId: string): Promise<T> {
  const linha = await db
    .prepare(
      'SELECT s.* FROM sugestoes s JOIN mensagens m ON m.id = s.mensagem_id JOIN conversas c ON c.id = m.conversa_id WHERE s.id = ? AND c.usuario_id = ?',
    )
    .bind(sugestaoId, usuarioId)
    .first<T>();
  if (!linha) throw naoEncontrado();
  return linha;
}
